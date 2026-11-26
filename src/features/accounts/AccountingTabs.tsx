import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'

const TABS = [
  { to: '/accounting/accounts', labelKey: 'accounts.title' },
  { to: '/accounting/mappings', labelKey: 'mappings.title' },
  { to: '/accounting/bank-accounts', labelKey: 'bankAccounts.title' },
  { to: '/accounting/journal', labelKey: 'journal.title' },
  { to: '/accounting/bank-reconciliation', labelKey: 'bankRecon.tab' },
  { to: '/accounting/inventory', labelKey: 'stock.tab' },
  { to: '/accounting/fixed-assets', labelKey: 'fa.tab' },
]

export function AccountingTabs() {
  const { t } = useTranslation()
  return (
    <nav
      className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-full bg-muted p-1"
      aria-label={t('nav.accounting')}
    >
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            cn(
              'flex h-9 shrink-0 items-center rounded-full px-4 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground',
              isActive && 'bg-card text-foreground shadow-card',
            )
          }
        >
          {t(tab.labelKey)}
        </NavLink>
      ))}
    </nav>
  )
}
