import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { AssetRow } from './model'

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  // jsonb results: cast at this one boundary
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)(fn, args)
  if (error) throw error
  return data as T
}
const key = (companyId: string) => ['fixed-assets', companyId] as const

export interface Category {
  id: string
  name: string
  asset_account_id: string
  accum_account_id: string
  default_life_months: number
  is_active: boolean
}
export interface PendingLine {
  line_id: string
  document_id: string
  number: string
  doc_date: string
  contact: string | null
  description: string
  cost: number
  category_id: string | null
}
export interface Run {
  id: string
  month: string
  total: number
  status: 'posted' | 'voided'
  posted_at: string
}
export interface DisposalPreview {
  cost: number
  booked: number
  top_up: number
  accum: number
  nbv: number
  proceeds: number
  gain: number
}

export const useAssets = (companyId: string, asOf: string) =>
  useQuery({
    queryKey: [...key(companyId), 'register', asOf],
    queryFn: () =>
      rpc<AssetRow[]>('fixed_asset_register', { p_company_id: companyId, p_as_of: asOf }),
  })

export function useCategories(companyId: string, canInit: boolean) {
  const qc = useQueryClient()
  return useQuery({
    queryKey: [...key(companyId), 'categories'],
    queryFn: async () => {
      const read = () =>
        supabase
          .from('asset_categories')
          .select('*')
          .eq('company_id', companyId)
          .order('created_at')
      let { data, error } = await read()
      if (error) throw error
      // first visit: create the default categories from the chart of accounts
      if (data!.length === 0 && canInit) {
        await rpc('init_asset_categories', { p_company_id: companyId })
        ;({ data, error } = await read())
        if (error) throw error
        void qc.invalidateQueries({ queryKey: ['accounts'] })
      }
      return data as Category[]
    },
  })
}

export const usePendingLines = (companyId: string) =>
  useQuery({
    queryKey: [...key(companyId), 'pending-lines'],
    queryFn: () => rpc<PendingLine[]>('unregistered_asset_lines', { p_company_id: companyId }),
  })

export function useRuns(companyId: string) {
  return useQuery({
    queryKey: [...key(companyId), 'runs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('depreciation_runs')
        .select('id, month, total, status, posted_at')
        .eq('company_id', companyId)
        .order('month', { ascending: false })
      if (error) throw error
      return data as Run[]
    },
  })
}

export const useDepreciationPreview = (companyId: string, month: string | null) =>
  useQuery({
    queryKey: [...key(companyId), 'preview', month],
    enabled: !!month,
    queryFn: () =>
      rpc<{ asset_id: string; code: string; name: string; amount: number }[]>(
        'depreciation_preview',
        {
          p_company_id: companyId,
          p_month: month,
        },
      ),
  })

export const useDisposalPreview = (assetId: string | null, date: string, proceeds: number) =>
  useQuery({
    queryKey: ['disposal-preview', assetId, date, proceeds],
    enabled: !!assetId && !!date,
    queryFn: () =>
      rpc<DisposalPreview>('disposal_preview', {
        p_asset_id: assetId,
        p_date: date,
        p_proceeds: proceeds,
      }),
  })

function useFaMutation<V, R>(companyId: string, fn: (v: V) => Promise<R>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: key(companyId) })
      void qc.invalidateQueries({ queryKey: ['report'] })
      void qc.invalidateQueries({ queryKey: ['documents'] })
    },
  })
}

export const useRegister = (companyId: string) =>
  useFaMutation(companyId, (p: Record<string, unknown>) =>
    rpc<string>('register_fixed_asset', { p_payload: { company_id: companyId, ...p } }),
  )
export const useRunDepreciation = (companyId: string) =>
  useFaMutation(companyId, (month: string) =>
    rpc<string>('run_depreciation', { p_company_id: companyId, p_month: month }),
  )
export const useVoidRun = (companyId: string) =>
  useFaMutation(companyId, (id: string) => rpc('void_depreciation_run', { p_run_id: id }))
export const useDispose = (companyId: string) =>
  useFaMutation(companyId, (p: Record<string, unknown>) =>
    rpc('dispose_fixed_asset', { p_payload: p }),
  )
export const useSaveCategory = (companyId: string) =>
  useFaMutation(companyId, async (c: Omit<Category, 'id' | 'is_active'> & { id?: string }) => {
    const row = { ...c, company_id: companyId }
    const { error } = c.id
      ? await supabase.from('asset_categories').update(row).eq('id', c.id)
      : await supabase.from('asset_categories').insert(row)
    if (error) throw error
  })
