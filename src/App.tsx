import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { ChartOfAccountsPage } from '@/features/accounts/ChartOfAccountsPage'
import { MappingsPage } from '@/features/accounts/MappingsPage'
import { NAV_ITEMS } from '@/components/layout/nav-items'
import { RequireAuth, RequireCompany } from '@/features/auth/guards'
import { LoginPage } from '@/features/auth/LoginPage'
import { MembersPage } from '@/features/members/MembersPage'
import { OnboardingPage } from '@/features/onboarding/OnboardingPage'
import { ComingSoonPage } from '@/pages/ComingSoonPage'
import { HelloPage } from '@/pages/HelloPage'
import { SettingsPage } from '@/pages/SettingsPage'

const BUILT_ROUTES = ['/', '/settings', '/accounting']
const PLACEHOLDER_ROUTES = NAV_ITEMS.filter((i) => !BUILT_ROUTES.includes(i.to))

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route element={<RequireCompany />}>
          <Route element={<AppLayout />}>
            <Route index element={<HelloPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/settings/members" element={<MembersPage />} />
            <Route path="/accounting" element={<Navigate to="/accounting/accounts" replace />} />
            <Route path="/accounting/accounts" element={<ChartOfAccountsPage />} />
            <Route path="/accounting/mappings" element={<MappingsPage />} />
            {PLACEHOLDER_ROUTES.map((i) => (
              <Route key={i.to} path={i.to} element={<ComingSoonPage titleKey={i.labelKey} />} />
            ))}
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
