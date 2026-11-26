import { useQuery } from '@tanstack/react-query'
import { supabase, type Enums, type MemberRole } from '@/lib/supabase'
import type { Account } from './tree'

export type AccountType = Enums<'account_type'>
export type AccountRole = Enums<'account_role'>

export const ACCOUNT_TYPES: AccountType[] = ['asset', 'liability', 'equity', 'revenue', 'expense']

export const ACCOUNT_ROLES: AccountRole[] = [
  'CASH',
  'BANK',
  'AR',
  'INPUT_VAT',
  'INPUT_VAT_DEFERRED',
  'WHT_RECEIVABLE',
  'INVENTORY',
  'AP',
  'OUTPUT_VAT',
  'OUTPUT_VAT_DEFERRED',
  'WHT_PAYABLE',
  'RETAINED_EARNINGS',
  'SALES_REVENUE',
  'SALES_RETURNS',
  'DEFAULT_EXPENSE',
  'WHT_BORNE_EXPENSE',
  'COGS',
  'INVENTORY_ADJUSTMENT',
]

/** Must match SQL public.account_role_type(). */
export const ROLE_ACCOUNT_TYPE: Record<AccountRole, AccountType> = {
  CASH: 'asset',
  BANK: 'asset',
  AR: 'asset',
  INPUT_VAT: 'asset',
  INPUT_VAT_DEFERRED: 'asset',
  WHT_RECEIVABLE: 'asset',
  INVENTORY: 'asset',
  AP: 'liability',
  OUTPUT_VAT: 'liability',
  OUTPUT_VAT_DEFERRED: 'liability',
  WHT_PAYABLE: 'liability',
  RETAINED_EARNINGS: 'equity',
  SALES_REVENUE: 'revenue',
  SALES_RETURNS: 'revenue',
  DEFAULT_EXPENSE: 'expense',
  WHT_BORNE_EXPENSE: 'expense',
  COGS: 'expense',
  INVENTORY_ADJUSTMENT: 'expense',
}

/** Roles that may edit the chart of accounts (DB RLS enforces the same). */
export const canEditAccounts = (role: MemberRole | undefined) =>
  role === 'owner' || role === 'admin' || role === 'accountant'

export const accountsKey = (companyId: string) => ['accounts', companyId] as const
export const mappingsKey = (companyId: string) => ['account-mappings', companyId] as const

export function useAccounts(companyId: string) {
  return useQuery({
    queryKey: accountsKey(companyId),
    queryFn: async (): Promise<Account[]> => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('company_id', companyId)
        .order('code')
      if (error) throw error
      return data
    },
  })
}

export function useMappings(companyId: string) {
  return useQuery({
    queryKey: mappingsKey(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('account_mappings')
        .select('role, account_id')
        .eq('company_id', companyId)
      if (error) throw error
      return new Map(data.map((m) => [m.role, m.account_id]))
    },
  })
}

/** Display name in the current UI language (English falls back to Thai). */
export const accountName = (a: Pick<Account, 'name_th' | 'name_en'>, lang: string) =>
  lang === 'en' ? a.name_en || a.name_th : a.name_th
