import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'

const TABS = [
  { to: '/accounting/accounts', labelKey: 'accounts.title' },
  { to: '/accounting/mappings', labelKey: 'mappings.title' },
  { to: '/accounting/bank-accounts', labelKey: 'bankAccounts.title' },
]

export function AccountingTabs() {
  const { t } = useTranslation()
  return (
    <nav className="flex gap-1 border-b" aria-label={t('nav.accounting')}>
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            cn(
              '-mb-px border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground hover:text-foreground',
              isActive && 'border-primary font-medium text-foreground',
            )
          }
        >
          {t(tab.labelKey)}
        </NavLink>
      ))}
    </nav>
  )
}
