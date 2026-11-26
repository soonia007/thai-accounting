import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  // jsonb results: cast at this one boundary
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)(fn, args)
  if (error) throw error
  return data as T
}

export interface CheckItem {
  key: 'drafts' | 'bank' | 'depreciation' | 'vat' | 'balanced'
  ok: boolean
  count?: number
  amount?: number
  applies?: boolean
}
export interface CloseRow {
  id: string
  month: string
  closed_at: string
  reopened_at: string | null
  reopen_reason: string | null
}
export interface YearPreview {
  year_start: string
  year_end: string
  net_profit: number
  months_closed: boolean
  closed: boolean
}

const key = (companyId: string) => ['period-close', companyId] as const

export function useChecklist(companyId: string, month: string | null) {
  return useQuery({
    queryKey: [...key(companyId), 'check', month],
    enabled: !!month,
    queryFn: () =>
      rpc<CheckItem[]>('period_close_checklist', { p_company_id: companyId, p_month: month }),
  })
}

export function useCloses(companyId: string) {
  return useQuery({
    queryKey: [...key(companyId), 'history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('period_closes')
        .select('id, month, closed_at, reopened_at, reopen_reason')
        .eq('company_id', companyId)
        .order('closed_at', { ascending: false })
        .limit(36)
      if (error) throw error
      return data as CloseRow[]
    },
  })
}

export function useYearPreview(companyId: string, yearEnd: string | null) {
  return useQuery({
    queryKey: [...key(companyId), 'year', yearEnd],
    enabled: !!yearEnd,
    queryFn: () =>
      rpc<YearPreview>('fiscal_year_preview', { p_company_id: companyId, p_year_end: yearEnd }),
  })
}

/** Every close action changes companies.locked_through → refresh everything. */
export function useCloseAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ fn, args }: { fn: string; args: Record<string, unknown> }) =>
      rpc<unknown>(fn, args),
    onSuccess: () => qc.invalidateQueries(),
  })
}
