import {
  BarChart3,
  BookOpen,
  Home,
  Receipt,
  Settings,
  ShoppingCart,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  labelKey: string
  icon: LucideIcon
  /** Show in the mobile bottom nav (max 5 items) */
  mobile: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', labelKey: 'nav.dashboard', icon: Home, mobile: true },
  { to: '/sales', labelKey: 'nav.sales', icon: Receipt, mobile: true },
  { to: '/purchases', labelKey: 'nav.purchases', icon: ShoppingCart, mobile: true },
  { to: '/accounting', labelKey: 'nav.accounting', icon: BookOpen, mobile: false },
  { to: '/reports', labelKey: 'nav.reports', icon: BarChart3, mobile: true },
  { to: '/settings', labelKey: 'nav.settings', icon: Settings, mobile: true },
]
