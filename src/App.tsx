import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { ChartOfAccountsPage } from '@/features/accounts/ChartOfAccountsPage'
import { MappingsPage } from '@/features/accounts/MappingsPage'
import { BankAccountsPage } from '@/features/bank-accounts/BankAccountsPage'
import { ContactsPage } from '@/features/contacts/ContactsPage'
import { ProductsPage } from '@/features/products/ProductsPage'
import { MenuPage } from '@/pages/MenuPage'
import { DocumentPage } from '@/features/documents/DocumentPage'
import { DocumentsListPage } from '@/features/documents/DocumentsListPage'
import { PaymentPage } from '@/features/documents/PaymentPage'
import { CompanySettingsPage } from '@/pages/CompanySettingsPage'
import { SharePage } from '@/pages/SharePage'
import { NAV_ITEMS } from '@/components/layout/nav-items'
import { RequireAuth, RequireCompany } from '@/features/auth/guards'
import { LoginPage } from '@/features/auth/LoginPage'
import { MembersPage } from '@/features/members/MembersPage'
import { OnboardingPage } from '@/features/onboarding/OnboardingPage'
import { WhtCertificatesPage } from '@/features/wht/WhtCertificatesPage'
import { ComingSoonPage } from '@/pages/ComingSoonPage'
import { HelloPage } from '@/pages/HelloPage'
import { SettingsPage } from '@/pages/SettingsPage'

const BUILT_ROUTES = [
  '/',
  '/settings',
  '/accounting',
  '/contacts',
  '/products',
  '/sales',
  '/purchases',
]
const PLACEHOLDER_ROUTES = NAV_ITEMS.filter((i) => !BUILT_ROUTES.includes(i.to))

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/share/:token" element={<SharePage />} />
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
            <Route path="/accounting/bank-accounts" element={<BankAccountsPage />} />
            <Route path="/contacts" element={<ContactsPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/menu" element={<MenuPage />} />
            <Route path="/settings/company" element={<CompanySettingsPage />} />
            <Route path="/sales" element={<DocumentsListPage direction="sales" />} />
            <Route path="/sales/new/:type" element={<DocumentPage direction="sales" />} />
            <Route path="/sales/payments/new" element={<PaymentPage direction="sales" />} />
            <Route path="/sales/payments/:id" element={<PaymentPage direction="sales" />} />
            <Route path="/sales/:id" element={<DocumentPage direction="sales" />} />
            <Route path="/purchases" element={<DocumentsListPage direction="purchases" />} />
            <Route path="/purchases/new/:type" element={<DocumentPage direction="purchases" />} />
            <Route path="/purchases/payments/new" element={<PaymentPage direction="purchases" />} />
            <Route path="/purchases/payments/:id" element={<PaymentPage direction="purchases" />} />
            <Route path="/purchases/wht-certificates" element={<WhtCertificatesPage />} />
            <Route path="/purchases/:id" element={<DocumentPage direction="purchases" />} />
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
