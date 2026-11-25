import {
  BarChart3,
  BookOpen,
  FlaskConical,
  Home,
  LayoutGrid,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Users,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  labelKey: string
  icon: LucideIcon
  /** Show in the mobile bottom nav (max 4 + the "menu" item) */
  mobile: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', labelKey: 'nav.dashboard', icon: Home, mobile: true },
  { to: '/sales', labelKey: 'nav.sales', icon: Receipt, mobile: true },
  { to: '/purchases', labelKey: 'nav.purchases', icon: ShoppingCart, mobile: true },
  { to: '/contacts', labelKey: 'nav.contacts', icon: Users, mobile: true },
  { to: '/products', labelKey: 'nav.products', icon: Package, mobile: false },
  { to: '/accounting', labelKey: 'nav.accounting', icon: BookOpen, mobile: false },
  { to: '/sandbox', labelKey: 'nav.sandbox', icon: FlaskConical, mobile: false },
  { to: '/reports', labelKey: 'nav.reports', icon: BarChart3, mobile: false },
  { to: '/settings', labelKey: 'nav.settings', icon: Settings, mobile: false },
]

/** Mobile-only: opens a page listing every section. */
export const MENU_ITEM: NavItem = {
  to: '/menu',
  labelKey: 'nav.menu',
  icon: LayoutGrid,
  mobile: true,
}
