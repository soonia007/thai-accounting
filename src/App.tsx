import { lazy, Suspense } from 'react'
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
import { RequireAuth, RequireCompany } from '@/features/auth/guards'
import { LoginPage } from '@/features/auth/LoginPage'
import { JournalEntryPage } from '@/features/journal/JournalEntryPage'
import { JournalListPage } from '@/features/journal/JournalListPage'
import { MembersPage } from '@/features/members/MembersPage'
import { OnboardingPage } from '@/features/onboarding/OnboardingPage'
import { WhtCertificatesPage } from '@/features/wht/WhtCertificatesPage'
import { SettingsPage } from '@/pages/SettingsPage'

// Heavier pages (charts, marketing visuals) load on demand to keep the first download small
const DashboardPage = lazy(() =>
  import('@/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)
const SandboxPage = lazy(() =>
  import('@/features/sandbox/SandboxPage').then((m) => ({ default: m.SandboxPage })),
)
const LandingPage = lazy(() =>
  import('@/features/landing/LandingPage').then((m) => ({ default: m.LandingPage })),
)
const TrialBalancePage = lazy(() =>
  import('@/features/reports/ReportPages').then((m) => ({ default: m.TrialBalancePage })),
)
const IncomeStatementPage = lazy(() =>
  import('@/features/reports/ReportPages').then((m) => ({ default: m.IncomeStatementPage })),
)
const BalanceSheetPage = lazy(() =>
  import('@/features/reports/ReportPages').then((m) => ({ default: m.BalanceSheetPage })),
)
const GeneralLedgerPage = lazy(() =>
  import('@/features/reports/ReportPages').then((m) => ({ default: m.GeneralLedgerPage })),
)
const ReceivablePayablePage = lazy(() =>
  import('@/features/reports/ReportPages').then((m) => ({ default: m.ReceivablePayablePage })),
)
const VatReportPage = lazy(() =>
  import('@/features/vat/VatReportPage').then((m) => ({ default: m.VatReportPage })),
)
const WhtReportPage = lazy(() =>
  import('@/features/wht/WhtReportPage').then((m) => ({ default: m.WhtReportPage })),
)
const BankReconPage = lazy(() =>
  import('@/features/bank-recon/BankReconPage').then((m) => ({ default: m.BankReconPage })),
)
const InventoryPage = lazy(() =>
  import('@/features/inventory/InventoryPage').then((m) => ({ default: m.InventoryPage })),
)
const FixedAssetsPage = lazy(() =>
  import('@/features/fixed-assets/FixedAssetsPage').then((m) => ({ default: m.FixedAssetsPage })),
)

export default function App() {
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <Routes>
        <Route path="/welcome" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/share/:token" element={<SharePage />} />
        <Route element={<RequireAuth />}>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route element={<RequireCompany />}>
            <Route element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="/sandbox" element={<SandboxPage />} />
              <Route path="/reports" element={<Navigate to="/reports/trial-balance" replace />} />
              <Route path="/reports/trial-balance" element={<TrialBalancePage />} />
              <Route path="/reports/vat" element={<VatReportPage />} />
              <Route path="/reports/wht" element={<WhtReportPage />} />
              <Route path="/reports/income-statement" element={<IncomeStatementPage />} />
              <Route path="/reports/balance-sheet" element={<BalanceSheetPage />} />
              <Route path="/reports/general-ledger" element={<GeneralLedgerPage />} />
              <Route path="/reports/receivables-payables" element={<ReceivablePayablePage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/settings/members" element={<MembersPage />} />
              <Route path="/accounting" element={<Navigate to="/accounting/accounts" replace />} />
              <Route path="/accounting/accounts" element={<ChartOfAccountsPage />} />
              <Route path="/accounting/mappings" element={<MappingsPage />} />
              <Route path="/accounting/bank-accounts" element={<BankAccountsPage />} />
              <Route path="/accounting/bank-reconciliation" element={<BankReconPage />} />
              <Route path="/accounting/inventory" element={<InventoryPage />} />
              <Route path="/accounting/fixed-assets" element={<FixedAssetsPage />} />
              <Route path="/accounting/journal" element={<JournalListPage />} />
              <Route path="/accounting/journal/new" element={<JournalEntryPage />} />
              <Route path="/accounting/journal/:id" element={<JournalEntryPage />} />
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
              <Route
                path="/purchases/payments/new"
                element={<PaymentPage direction="purchases" />}
              />
              <Route
                path="/purchases/payments/:id"
                element={<PaymentPage direction="purchases" />}
              />
              <Route path="/purchases/wht-certificates" element={<WhtCertificatesPage />} />
              <Route path="/purchases/:id" element={<DocumentPage direction="purchases" />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
