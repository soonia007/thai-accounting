import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export const journalsKey = (companyId: string) => ['manual-journals', companyId] as const

export interface JournalListRow {
  id: string
  number: string | null
  status: 'draft' | 'posted' | 'voided'
  entry_date: string
  memo: string | null
  reference: string | null
  total: number
  lines: number
}

/** All manual journals of the company, newest first, with their debit total. */
export function useJournalList(companyId: string) {
  return useQuery({
    queryKey: journalsKey(companyId),
    queryFn: async (): Promise<JournalListRow[]> => {
      const { data, error } = await supabase
        .from('manual_journals')
        .select('id, number, status, entry_date, memo, reference, manual_journal_lines (debit)')
        .eq('company_id', companyId)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return data.map((j) => ({
        id: j.id,
        number: j.number,
        status: j.status,
        entry_date: j.entry_date,
        memo: j.memo,
        reference: j.reference,
        total: j.manual_journal_lines.reduce((s, l) => s + Number(l.debit), 0),
        lines: j.manual_journal_lines.length,
      }))
    },
  })
}

export function useJournal(id: string | undefined) {
  return useQuery({
    queryKey: ['manual-journal', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('manual_journals')
        .select(
          '*, manual_journal_lines (line_no, account_id, description, debit, credit, contact_id)',
        )
        .eq('id', id!)
        .single()
      if (error) throw error
      return {
        ...data,
        lines: [...data.manual_journal_lines].sort((a, b) => a.line_no - b.line_no),
      }
    },
  })
}

/**
 * One-tap starting points for common adjusting entries. Accounts are looked up by code in the
 * company's chart (template codes); a code that is missing simply leaves the line empty.
 */
export const JOURNAL_TEMPLATES = [
  {
    key: 'depreciation',
    lines: [
      { code: '5270', side: 'debit' },
      { code: '1211', side: 'credit' },
    ],
  },
  {
    key: 'accrual',
    lines: [
      { code: '5290', side: 'debit' },
      { code: '2140', side: 'credit' },
    ],
  },
  {
    key: 'prepaid',
    lines: [
      { code: '5290', side: 'debit' },
      { code: '1170', side: 'credit' },
    ],
  },
  {
    key: 'cashToBank',
    lines: [
      { code: '1120', side: 'debit' },
      { code: '1110', side: 'credit' },
    ],
  },
] as const
