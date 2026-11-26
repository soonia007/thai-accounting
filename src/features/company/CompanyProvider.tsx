import { useQuery } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '@/features/auth/AuthProvider'
import { supabase, type MemberRole, type Tables } from '@/lib/supabase'

export type MyCompany = Pick<
  Tables<'companies'>,
  | 'id'
  | 'name'
  | 'tax_id'
  | 'vat_registered'
  | 'vat_rate'
  | 'date_era'
  | 'logo_path'
  | 'locked_through'
  | 'fiscal_year_start_month'
> & {
  role: MemberRole
}

interface CompanyState {
  companies: MyCompany[]
  current: MyCompany | null
  isLoading: boolean
  switchCompany: (id: string) => void
}

const STORAGE_KEY = 'currentCompanyId'
const CompanyContext = createContext<CompanyState | null>(null)

// eslint-disable-next-line react-refresh/only-export-components
export const myCompaniesKey = (userId: string | undefined) => ['my-companies', userId] as const

async function fetchMyCompanies(userId: string): Promise<MyCompany[]> {
  const { data, error } = await supabase
    .from('company_members')
    .select(
      'role, companies!inner (id, name, tax_id, vat_registered, vat_rate, date_era, logo_path, locked_through, fiscal_year_start_month)',
    )
    .eq('user_id', userId)
  if (error) throw error
  return data
    .map((m) => ({ ...m.companies, role: m.role }))
    .sort((a, b) => a.name.localeCompare(b.name, 'th'))
}

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const userId = session?.user.id
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_KEY),
  )

  const { data: companies = [], isLoading } = useQuery({
    queryKey: myCompaniesKey(userId),
    queryFn: () => fetchMyCompanies(userId!),
    enabled: !!userId,
  })

  const switchCompany = useCallback((id: string) => {
    localStorage.setItem(STORAGE_KEY, id)
    setSelectedId(id)
  }, [])

  // Fall back to the first company if the stored one is gone (left / removed / other user)
  const current = companies.find((c) => c.id === selectedId) ?? companies[0] ?? null

  const value = useMemo(
    () => ({ companies, current, isLoading: isLoading && !!userId, switchCompany }),
    [companies, current, isLoading, userId, switchCompany],
  )
  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCompany() {
  const ctx = useContext(CompanyContext)
  if (!ctx) throw new Error('useCompany must be used inside CompanyProvider')
  return ctx
}

/** Roles allowed to manage company settings and members (DB enforces the same rule). */
// eslint-disable-next-line react-refresh/only-export-components
export const canManageMembers = (role: MemberRole | undefined) =>
  role === 'owner' || role === 'admin'
