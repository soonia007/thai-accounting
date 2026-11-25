import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { VatRow, VatSummary } from './model'

const key = (companyId: string, month: string) => ['vat', companyId, month] as const

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  // jsonb results: cast at this one boundary
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)(fn, args)
  if (error) throw error
  return data as T
}

export const useVatSales = (companyId: string, month: string) =>
  useQuery({
    queryKey: [...key(companyId, month), 'sales'],
    queryFn: () => rpc<VatRow[]>('report_vat_sales', { p_company_id: companyId, p_month: month }),
  })

export const useVatPurchases = (companyId: string, month: string) =>
  useQuery({
    queryKey: [...key(companyId, month), 'purchases'],
    queryFn: () =>
      rpc<VatRow[]>('report_vat_purchases', { p_company_id: companyId, p_month: month }),
  })

export const useVatSummary = (companyId: string, month: string) =>
  useQuery({
    queryKey: [...key(companyId, month), 'summary'],
    queryFn: () =>
      rpc<VatSummary>('vat_return_summary', { p_company_id: companyId, p_month: month }),
  })

export function useFileVatReturn(companyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: {
      month: string
      choice: 'refund' | 'carry' | null
      carriedIn: number | null
    }) =>
      rpc<void>('file_vat_return', {
        p_company_id: companyId,
        p_month: v.month,
        p_excess_choice: v.choice,
        p_carried_in: v.carriedIn,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vat', companyId] }),
  })
}

export function useUnfileVatReturn(companyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (month: string) =>
      rpc<void>('unfile_vat_return', { p_company_id: companyId, p_month: month }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vat', companyId] }),
  })
}
