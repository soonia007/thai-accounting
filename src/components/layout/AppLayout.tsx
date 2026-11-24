import { useTranslation } from 'react-i18next'
import { NavLink, Outlet } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { LanguageSwitcher } from './LanguageSwitcher'
import { NAV_ITEMS } from './nav-items'

export function AppLayout() {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-muted/40 md:flex">
        <div className="px-4 py-5 text-lg font-semibold">{t('app.name')}</div>
        <nav aria-label="sidebar" className="flex flex-1 flex-col gap-1 px-2">
          {NAV_ITEMS.map(({ to, labelKey, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-accent',
                  isActive && 'bg-accent font-medium',
                )
              }
            >
              <Icon className="size-4" />
              {t(labelKey)}
            </NavLink>
          ))}
        </nav>
        <div className="border-t p-3">
          <LanguageSwitcher />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="pt-safe sticky top-0 z-10 flex items-center justify-between border-b bg-background px-4 py-2 md:hidden">
          <span className="font-semibold">{t('app.name')}</span>
          <LanguageSwitcher />
        </header>

        <main className="flex-1 p-4 pb-24 md:p-8 md:pb-8">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav
          aria-label="bottom navigation"
          className="pb-safe fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t bg-background md:hidden"
        >
          {NAV_ITEMS.filter((i) => i.mobile).map(({ to, labelKey, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-1 py-2 text-xs text-muted-foreground',
                  isActive && 'text-foreground',
                )
              }
            >
              <Icon className="size-5" />
              {t(labelKey)}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
