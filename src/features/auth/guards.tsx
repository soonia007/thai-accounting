import { Loader2 } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useCompany } from '@/features/company/CompanyProvider'
import { useAuth } from './AuthProvider'

function FullPageSpinner() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="loading" />
    </div>
  )
}

/** Signed-in users only. */
export function RequireAuth() {
  const { session, loading } = useAuth()
  const { pathname } = useLocation()
  if (loading) return <FullPageSpinner />
  // Visitors opening the home page see the product page; deep links go straight to sign-in
  if (!session) return <Navigate to={pathname === '/' ? '/welcome' : '/login'} replace />
  return <Outlet />
}

/** Users who belong to at least one company; others go to onboarding. */
export function RequireCompany() {
  const { current, isLoading } = useCompany()
  if (isLoading) return <FullPageSpinner />
  if (!current) return <Navigate to="/onboarding" replace />
  return <Outlet />
}
