import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ColumnMapping, ParsedLine } from './parse'

export interface StatementLine {
  id: string
  txn_date: string
  description: string
  reference: string | null
  amount: number
  balance: number | null
  matched: boolean
  book: { ref: string | null; entry_date: string; amount: number }[]
}
export interface BookLine {
  id: string
  entry_date: string
  amount: number
  ref: string | null
  description: string | null
  contact: string | null
}
export interface ReconcileData {
  statement: StatementLine[]
  book: BookLine[]
  mapping: ColumnMapping | null
}
export interface Suggestion {
  statement_line_id: string
  journal_line_id: string
  score: number
}
export interface Reconciliation {
  as_of: string
  book_balance: number
  statement_balance: number | null
  book_not_on_statement: {
    date: string
    ref: string | null
    description: string | null
    contact: string | null
    amount: number
  }[]
  book_not_on_statement_total: number
  statement_not_in_book: { date: string; ref: string | null; description: string; amount: number }[]
  statement_not_in_book_total: number
  difference: number | null
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  // jsonb results: cast at this one boundary
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)(fn, args)
  if (error) throw error
  return data as T
}

const key = (bankId: string) => ['bank-recon', bankId] as const

export function useBankAccounts(companyId: string) {
  return useQuery({
    queryKey: ['bank-accounts', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('created_at')
      if (error) throw error
      return data
    },
  })
}

export const useReconcileData = (bankId: string | undefined) =>
  useQuery({
    queryKey: [...key(bankId ?? ''), 'data'],
    enabled: !!bankId,
    queryFn: () => rpc<ReconcileData>('bank_reconcile_data', { p_bank_account_id: bankId }),
  })

export const useReconciliation = (
  bankId: string | undefined,
  asOf: string,
  stmtBalance: number | null,
) =>
  useQuery({
    queryKey: [...key(bankId ?? ''), 'report', asOf, stmtBalance],
    enabled: !!bankId,
    queryFn: () =>
      rpc<Reconciliation>('bank_reconciliation', {
        p_bank_account_id: bankId,
        p_as_of: asOf,
        p_statement_balance: stmtBalance,
      }),
  })

/** Every write refreshes the bank's data, the report and the ledger-based views. */
function useBankMutation<V, R>(bankId: string, fn: (v: V) => Promise<R>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: key(bankId) })
      void qc.invalidateQueries({ queryKey: ['report'] })
      void qc.invalidateQueries({ queryKey: ['manual-journals'] })
    },
  })
}

export const useImportStatement = (bankId: string) =>
  useBankMutation(bankId, (v: { fileName: string; lines: ParsedLine[]; mapping: ColumnMapping }) =>
    rpc<{ statement_id: string | null; inserted: number; skipped: number }>(
      'import_bank_statement',
      {
        p_bank_account_id: bankId,
        p_file_name: v.fileName,
        p_lines: v.lines,
        p_mapping: v.mapping,
      },
    ),
  )

export const useSuggestions = (bankId: string) =>
  useMutation({
    mutationFn: () => rpc<Suggestion[]>('bank_match_suggestions', { p_bank_account_id: bankId }),
  })

export const useMatch = (bankId: string) =>
  useBankMutation(
    bankId,
    async (pairs: { statementLineId: string; journalLineIds: string[] }[]) => {
      for (const p of pairs)
        await rpc('match_bank_line', {
          p_statement_line_id: p.statementLineId,
          p_journal_line_ids: p.journalLineIds,
        })
    },
  )

export const useUnmatch = (bankId: string) =>
  useBankMutation(bankId, (statementLineId: string) =>
    rpc('unmatch_bank_line', { p_statement_line_id: statementLineId }),
  )

export const useAdjustment = (bankId: string) =>
  useBankMutation(bankId, (v: { statementLineId: string; accountId: string; memo: string }) =>
    rpc('create_bank_adjustment', {
      p_statement_line_id: v.statementLineId,
      p_account_id: v.accountId,
      p_memo: v.memo,
    }),
  )
