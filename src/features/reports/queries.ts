import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { AmountRow, ArApRow, BalanceSheetData, GlAccount, TbRow } from './model'

/** Common shape of the report filters (see useReportScope). */
export interface ScopeArgs {
  companyIds: string[]
  from: string
  to: string
}

const key = (name: string, ...rest: unknown[]) => ['report', name, ...rest] as const

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  // the generated types do not know our jsonb shapes; cast at this one boundary
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)(fn, args)
  if (error) throw error
  return data as T
}

export const useTrialBalance = (s: ScopeArgs) =>
  useQuery({
    queryKey: key('tb', s),
    queryFn: () =>
      rpc<TbRow[]>('report_trial_balance', {
        p_company_ids: s.companyIds,
        p_from: s.from,
        p_to: s.to,
      }),
  })

export const useIncomeStatement = (s: ScopeArgs) =>
  useQuery({
    queryKey: key('is', s),
    queryFn: () =>
      rpc<AmountRow[]>('report_income_statement', {
        p_company_ids: s.companyIds,
        p_from: s.from,
        p_to: s.to,
      }),
  })

export const useBalanceSheet = (s: ScopeArgs) =>
  useQuery({
    queryKey: key('bs', s.companyIds, s.to),
    queryFn: () =>
      rpc<BalanceSheetData>('report_balance_sheet', {
        p_company_ids: s.companyIds,
        p_as_of: s.to,
      }),
  })

export const useGeneralLedger = (s: ScopeArgs, accountCode: string | null) =>
  useQuery({
    queryKey: key('gl', s, accountCode),
    queryFn: () =>
      rpc<GlAccount[]>('report_general_ledger', {
        p_company_ids: s.companyIds,
        p_from: s.from,
        p_to: s.to,
        p_account_code: accountCode,
      }),
  })

export const useReceivablePayable = (s: ScopeArgs, kind: 'ar' | 'ap') =>
  useQuery({
    queryKey: key('arap', s.companyIds, s.to, kind),
    queryFn: () =>
      rpc<ArApRow[]>('report_receivable_payable', {
        p_company_ids: s.companyIds,
        p_as_of: s.to,
        p_kind: kind,
      }),
  })

/** Accounts (by code) across the selected companies, for the general-ledger picker. */
export const useAccountChoices = (companyIds: string[]) =>
  useQuery({
    queryKey: key('accounts', companyIds),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('code, name_th, name_en')
        .in('company_id', companyIds)
        .eq('is_group', false)
        .order('code')
      if (error) throw error
      const seen = new Map<string, { code: string; name_th: string; name_en: string }>()
      for (const a of data)
        if (!seen.has(a.code)) seen.set(a.code, { ...a, name_en: a.name_en ?? a.name_th })
      return [...seen.values()]
    },
  })
