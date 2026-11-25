import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type AccountTypeName = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'

export interface SimLine {
  account_id: string
  code: string
  name_th: string
  name_en: string | null
  type: AccountTypeName
  role: string | null
  debit: number
  credit: number
  sources: string[]
  /** debit − credit of posted entries up to the document date */
  opening_balance: number
}

export interface SimTotals {
  subtotal: number
  vat_total: number
  vat_deferred_total: number
  total: number
  wht_total: number
  net_total: number
}

export type SimResult =
  | {
      ok: true
      lines: SimLine[]
      totals: SimTotals | null
      next: { type: string; lines: SimLine[] } | null
    }
  | { ok: false; error: string; detail?: string }

/** Debit-normal accounts show balances as debit − credit; the others as credit − debit. */
export const isDebitNormal = (type: AccountTypeName) => type === 'asset' || type === 'expense'

export function normalBalance(type: AccountTypeName, debitMinusCredit: number) {
  const v = isDebitNormal(type) ? debitMinusCredit : -debitMinusCredit
  return v === 0 ? 0 : v // never show -0.00
}

/**
 * i18n key + params for the plain-language sentence of one journal line
 * (docs/DESIGN_SIMULATION.md §1 — keyed on account role + side, not account codes).
 */
export function plainSentence(line: SimLine): { key: string; icon: string } {
  const side = line.debit > 0 ? 'dr' : 'cr'
  const sources = line.sources ?? []
  if (line.role) {
    const roleKey = `${line.role}.${side}`
    return { key: `plain.role.${roleKey}`, icon: ROLE_ICONS[line.role] ?? 'circle' }
  }
  if (sources.includes('payment')) {
    return { key: `plain.money.${side}`, icon: 'banknote' }
  }
  return { key: `plain.type.${line.type}.${side}`, icon: TYPE_ICONS[line.type] }
}

const ROLE_ICONS: Record<string, string> = {
  AR: 'user',
  AP: 'store',
  OUTPUT_VAT: 'landmark',
  OUTPUT_VAT_DEFERRED: 'hourglass',
  INPUT_VAT: 'landmark',
  INPUT_VAT_DEFERRED: 'hourglass',
  WHT_RECEIVABLE: 'receipt',
  WHT_PAYABLE: 'receipt',
  SALES_REVENUE: 'trending-up',
  SALES_RETURNS: 'undo',
  DEFAULT_EXPENSE: 'trending-down',
  WHT_BORNE_EXPENSE: 'receipt',
  BANK: 'banknote',
  CASH: 'banknote',
}
const TYPE_ICONS: Record<AccountTypeName, string> = {
  asset: 'package',
  liability: 'file-clock',
  equity: 'scale',
  revenue: 'trending-up',
  expense: 'trending-down',
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return v
}

/** Live preview from the DB engine (simulate_posting) — debounced, keeps the last result while typing. */
export function usePostingSimulation(
  kind: 'document' | 'payment',
  payload: Record<string, unknown> | null,
) {
  const key = useDebounced(payload ? JSON.stringify(payload) : null, 300)
  return useQuery({
    queryKey: ['simulate', kind, key],
    enabled: !!key,
    placeholderData: keepPreviousData,
    staleTime: 10_000,
    queryFn: async (): Promise<SimResult> => {
      const { data, error } = await supabase.rpc('simulate_posting', {
        p_kind: kind,
        p_payload: JSON.parse(key!),
      })
      if (error) throw error
      return data as unknown as SimResult
    },
  })
}

/** Journal entries of a posted document/payment, shaped like simulation lines. */
export function usePostedJournal(
  target: { documentId?: string; paymentId?: string; manualJournalId?: string },
  enabled: boolean,
) {
  const id = target.documentId ?? target.paymentId ?? target.manualJournalId
  return useQuery({
    queryKey: ['posted-journal', id],
    enabled: enabled && !!id,
    queryFn: async () => {
      let q = supabase
        .from('journal_entries')
        .select(
          'id, entry_date, description, reverses_entry_id, journal_lines (line_no, debit, credit, account_id, accounts (code, name_th, name_en, type))',
        )
        .order('created_at')
      q = target.documentId
        ? q.eq('document_id', target.documentId)
        : target.paymentId
          ? q.eq('payment_id', target.paymentId)
          : q.eq('manual_journal_id', target.manualJournalId!)
      const [{ data, error }, { data: maps }] = await Promise.all([
        q,
        supabase.from('account_mappings').select('role, account_id'),
      ])
      if (error) throw error
      // attach account roles so the plain-language summary can use role sentences
      const roleOf = new Map((maps ?? []).map((m) => [m.account_id, m.role as string]))
      return data.map((e) => ({
        label: e.description ?? '',
        reversal: !!e.reverses_entry_id,
        lines: [...e.journal_lines]
          .sort((a, b) => a.line_no - b.line_no)
          .map((l): SimLine => ({
            account_id: l.account_id,
            code: l.accounts.code,
            name_th: l.accounts.name_th,
            name_en: l.accounts.name_en,
            type: l.accounts.type,
            role: roleOf.get(l.account_id) ?? null,
            debit: Number(l.debit),
            credit: Number(l.credit),
            sources: [],
            opening_balance: 0,
          })),
      }))
    },
  })
}
