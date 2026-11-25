import { useQuery } from '@tanstack/react-query'
import { mappingsKey } from '@/features/accounts/queries'
import { supabase, type Tables } from '@/lib/supabase'
import type { DocType } from './doc-types'

export type Contact = Tables<'contacts'>
export type Product = Tables<'products'>
export type DocumentRow = Tables<'documents'>
export type DocumentLine = Tables<'document_lines'>

export const documentsKey = (companyId: string) => ['documents', companyId] as const

export function useContacts(companyId: string) {
  return useQuery({
    queryKey: ['contacts', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('company_id', companyId)
        .order('name')
      if (error) throw error
      return data
    },
  })
}

export function useProducts(companyId: string) {
  return useQuery({
    queryKey: ['products', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('company_id', companyId)
        .order('code')
      if (error) throw error
      return data
    },
  })
}

export function useDocumentList(companyId: string, types: DocType[]) {
  return useQuery({
    queryKey: [...documentsKey(companyId), 'list', types],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_documents', {
        p_company_id: companyId,
        p_types: types,
      })
      if (error) throw error
      return data
    },
  })
}

export function usePaymentList(companyId: string, direction: 'received' | 'paid') {
  return useQuery({
    queryKey: [...documentsKey(companyId), 'payments', direction],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_payments', {
        p_company_id: companyId,
        p_direction: direction,
      })
      if (error) throw error
      return data
    },
  })
}

export function useDocument(id: string | undefined) {
  return useQuery({
    queryKey: ['document', id],
    enabled: !!id,
    queryFn: async () => {
      const [{ data: doc, error }, { data: lines, error: lErr }] = await Promise.all([
        supabase.from('documents').select('*').eq('id', id!).single(),
        supabase.from('document_lines').select('*').eq('document_id', id!).order('line_no'),
      ])
      if (error) throw error
      if (lErr) throw lErr
      return { doc, lines }
    },
  })
}

export function useDocumentBalance(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['document-balance', id],
    enabled: !!id && enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('document_balance', { p_document_id: id! })
      if (error) throw error
      return data as { outstanding: number; paid: number; deferred_vat_remaining: number }
    },
  })
}

/** Cash/bank ledger accounts to receive into / pay from: linked bank accounts + the CASH mapping. */
export function useMoneyAccounts(companyId: string) {
  return useQuery({
    queryKey: ['money-accounts', companyId, mappingsKey(companyId)],
    queryFn: async () => {
      const [{ data: banks, error }, { data: maps, error: mErr }, { data: accs, error: aErr }] =
        await Promise.all([
          supabase
            .from('bank_accounts')
            .select('account_id, bank_code, account_number, is_active')
            .eq('company_id', companyId)
            .eq('is_active', true),
          supabase
            .from('account_mappings')
            .select('role, account_id')
            .eq('company_id', companyId)
            .in('role', ['CASH', 'BANK']),
          supabase
            .from('accounts')
            .select('id, code, name_th, name_en')
            .eq('company_id', companyId)
            .eq('is_active', true),
        ])
      if (error) throw error
      if (mErr) throw mErr
      if (aErr) throw aErr
      const byId = new Map(accs.map((a) => [a.id, a]))
      const ids = new Set<string>()
      const out: {
        id: string
        code: string
        name_th: string
        name_en: string | null
        detail?: string
      }[] = []
      const push = (id: string | undefined, detail?: string) => {
        const a = id ? byId.get(id) : undefined
        if (a && !ids.has(a.id)) {
          ids.add(a.id)
          out.push({ ...a, detail })
        }
      }
      push(maps.find((m) => m.role === 'BANK')?.account_id)
      banks.forEach((b) => push(b.account_id, b.account_number))
      push(maps.find((m) => m.role === 'CASH')?.account_id)
      return out
    },
  })
}
