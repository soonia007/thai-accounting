import {
  BarChart3,
  BookOpen,
  FlaskConical,
  Home,
  LayoutGrid,
  Receipt,
  ScanLine,
  Settings,
  ShoppingCart,
  Users,
  type LucideIcon,
} from 'lucide-react'

/** One destination. Without `to` it is not built yet: shown greyed out with its milestone. */
export interface NavLeaf {
  id: string
  /** i18n key under `navTree.items.*` */
  labelKey: string
  to?: string
  /** Milestone (spec) that delivers it, e.g. "M8" — only for items without `to` */
  milestone?: string
  /** Match the path exactly (e.g. "/settings" must not light up for "/settings/company") */
  exact?: boolean
}

export interface NavGroup {
  id: string
  labelKey: string
  icon: LucideIcon
  items: NavLeaf[]
}

export interface NavSingle {
  id: string
  labelKey: string
  icon: LucideIcon
  to: string
}

export type NavNode = ({ kind: 'single' } & NavSingle) | ({ kind: 'group' } & NavGroup)

const leaf = (id: string, to?: string, milestone?: string, exact?: boolean): NavLeaf => ({
  id,
  labelKey: `navTree.items.${id}`,
  to,
  milestone,
  exact,
})

/** Every function of the product, grouped. Items not built yet are listed with their milestone. */
export const NAV_TREE: NavNode[] = [
  { kind: 'single', id: 'home', labelKey: 'nav.dashboard', icon: Home, to: '/' },
  {
    kind: 'group',
    id: 'sales',
    labelKey: 'nav.sales',
    icon: Receipt,
    items: [
      leaf('quotation', '/sales?tab=quotation'),
      leaf('invoice', '/sales?tab=invoice'),
      leaf('cash_sale', '/sales?tab=cash_sale'),
      leaf('credit_note', '/sales?tab=credit_note'),
      leaf('debit_note', '/sales?tab=debit_note'),
      leaf('receipts', '/sales?tab=payments'),
    ],
  },
  {
    kind: 'group',
    id: 'purchases',
    labelKey: 'nav.purchases',
    icon: ShoppingCart,
    items: [
      leaf('purchase_order', '/purchases?tab=purchase_order'),
      leaf('bill', '/purchases?tab=bill'),
      leaf('cash_purchase', '/purchases?tab=cash_purchase'),
      leaf('vendorPayments', '/purchases?tab=payments'),
      leaf('whtCertificates', '/purchases/wht-certificates'),
    ],
  },
  {
    kind: 'group',
    id: 'data',
    labelKey: 'navTree.groups.data',
    icon: Users,
    items: [
      leaf('contacts', '/contacts'),
      leaf('products', '/products'),
      leaf('warehouses', '/accounting/inventory?tab=settings'),
    ],
  },
  {
    kind: 'group',
    id: 'accounting',
    labelKey: 'nav.accounting',
    icon: BookOpen,
    items: [
      leaf('journal', '/accounting/journal'),
      leaf('chart', '/accounting/accounts'),
      leaf('mappings', '/accounting/mappings'),
      leaf('bankAccounts', '/accounting/bank-accounts'),
      leaf('bankRecon', '/accounting/bank-reconciliation'),
      leaf('stock', '/accounting/inventory'),
      leaf('fixedAssets', '/accounting/fixed-assets'),
      leaf('periodClose', '/accounting/period-close'),
    ],
  },
  {
    kind: 'group',
    id: 'reports',
    labelKey: 'nav.reports',
    icon: BarChart3,
    items: [
      leaf('trialBalance', '/reports/trial-balance'),
      leaf('incomeStatement', '/reports/income-statement'),
      leaf('balanceSheet', '/reports/balance-sheet'),
      leaf('generalLedger', '/reports/general-ledger'),
      leaf('arApSummary', '/reports/receivables-payables'),
      leaf('vatReport', '/reports/vat'),
      leaf('whtReport', '/reports/wht'),
      leaf('stockReport', '/accounting/inventory?tab=card'),
      leaf('fullDashboard', undefined, 'M16'),
    ],
  },
  {
    kind: 'group',
    id: 'import',
    labelKey: 'navTree.groups.import',
    icon: ScanLine,
    items: [
      leaf('ocrApi', undefined, 'M17'),
      leaf('upload', undefined, 'M18'),
      leaf('reviewQueue', undefined, 'M20'),
      leaf('vendorRules', undefined, 'M21'),
      leaf('autoPost', undefined, 'M22'),
    ],
  },
  { kind: 'single', id: 'sandbox', labelKey: 'nav.sandbox', icon: FlaskConical, to: '/sandbox' },
  {
    kind: 'group',
    id: 'settings',
    labelKey: 'nav.settings',
    icon: Settings,
    items: [
      leaf('general', '/settings', undefined, true),
      leaf('company', '/settings/company'),
      leaf('members', '/settings/members'),
    ],
  },
]

export interface MobileNavItem {
  to: string
  labelKey: string
  icon: LucideIcon
}

/** Bottom bar on phones (max 4 + the "menu" item, which opens the full tree). */
export const MOBILE_ITEMS: MobileNavItem[] = [
  { to: '/', labelKey: 'nav.dashboard', icon: Home },
  { to: '/sales', labelKey: 'nav.sales', icon: Receipt },
  { to: '/purchases', labelKey: 'nav.purchases', icon: ShoppingCart },
  { to: '/contacts', labelKey: 'nav.contacts', icon: Users },
]

export const MENU_ITEM: MobileNavItem = { to: '/menu', labelKey: 'nav.menu', icon: LayoutGrid }
