import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { BalanceRow, StockCard } from './model'

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  // jsonb results: cast at this one boundary
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)(fn, args)
  if (error) throw error
  return data as T
}

const key = (companyId: string) => ['inventory', companyId] as const

export const useStockBalance = (companyId: string, asOf: string) =>
  useQuery({
    queryKey: [...key(companyId), 'balance', asOf],
    queryFn: () => rpc<BalanceRow[]>('stock_balance', { p_company_id: companyId, p_as_of: asOf }),
  })

export const useStockCard = (productId: string | null, from: string, to: string) =>
  useQuery({
    queryKey: ['inventory-card', productId, from, to],
    enabled: !!productId,
    queryFn: () =>
      rpc<StockCard>('stock_card', { p_product_id: productId, p_from: from, p_to: to }),
  })

export function useAdjustments(companyId: string) {
  return useQuery({
    queryKey: [...key(companyId), 'adjustments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_adjustments')
        .select('id, number, adj_date, kind, memo, status, void_reason')
        .eq('company_id', companyId)
        .order('adj_date', { ascending: false })
        .order('number', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useInventorySettings(companyId: string) {
  return useQuery({
    queryKey: [...key(companyId), 'settings'],
    queryFn: async () => {
      const [co, wh, moved] = await Promise.all([
        supabase.from('companies').select('cost_method').eq('id', companyId).single(),
        supabase
          .from('warehouses')
          .select('id, name')
          .eq('company_id', companyId)
          .eq('is_default', true)
          .single(),
        supabase
          .from('stock_movements')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', companyId),
      ])
      if (co.error) throw co.error
      return {
        costMethod: (co.data.cost_method ?? 'fifo') as 'fifo' | 'average',
        chosen: co.data.cost_method !== null,
        locked: (moved.count ?? 0) > 0,
        warehouse: wh.data,
      }
    },
  })
}

function useInvMutation<V, R>(companyId: string, fn: (v: V) => Promise<R>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: key(companyId) })
      void qc.invalidateQueries({ queryKey: ['inventory-card'] })
      void qc.invalidateQueries({ queryKey: ['report'] })
    },
  })
}

export interface AdjustmentPayload {
  adj_date: string
  kind: 'opening' | 'count' | 'damage' | 'other'
  memo: string
  lines: { product_id: string; qty: number; unit_cost?: number | null }[]
}

export const usePostAdjustment = (companyId: string) =>
  useInvMutation(companyId, (p: AdjustmentPayload) =>
    rpc<string>('post_stock_adjustment', { p_payload: { company_id: companyId, ...p } }),
  )
export const useVoidAdjustment = (companyId: string) =>
  useInvMutation(companyId, (v: { id: string; reason: string }) =>
    rpc('void_stock_adjustment', { p_id: v.id, p_reason: v.reason }),
  )
export const useSetCostMethod = (companyId: string) =>
  useInvMutation(companyId, (m: 'fifo' | 'average') =>
    rpc('set_cost_method', { p_company_id: companyId, p_method: m }),
  )
export const useRenameWarehouse = (companyId: string) =>
  useInvMutation(companyId, async (v: { id: string; name: string }) => {
    const { error } = await supabase.from('warehouses').update({ name: v.name }).eq('id', v.id)
    if (error) throw error
  })
