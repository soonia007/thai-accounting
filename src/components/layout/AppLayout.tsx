import { useTranslation } from 'react-i18next'
import { NavLink, Outlet } from 'react-router-dom'
import { CompanySwitcher } from '@/features/company/CompanySwitcher'
import { cn } from '@/lib/utils'
import { BrandLogo, BrandMark } from './BrandMark'
import { LanguageSwitcher } from './LanguageSwitcher'
import { MENU_ITEM, NAV_ITEMS } from './nav-items'

export function AppLayout() {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border/70 bg-card md:flex">
        <div className="flex items-center gap-2.5 px-5 pt-5 pb-4">
          <BrandLogo className="text-[17px]" />
        </div>
        <div className="px-3 pb-3">
          <CompanySwitcher className="w-full" />
        </div>
        <nav aria-label="sidebar" className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3">
          {NAV_ITEMS.map(({ to, labelKey, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'group flex h-10 items-center gap-3 rounded-xl px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                  isActive && 'bg-accent font-medium text-brand-strong hover:bg-accent',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={cn('size-[18px]', isActive && 'text-brand')}
                    strokeWidth={isActive ? 2.2 : 1.8}
                  />
                  {t(labelKey)}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center justify-between border-t border-border/70 px-5 py-4">
          <span className="text-xs text-muted-foreground">{t('language')}</span>
          <LanguageSwitcher />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-border/60 bg-card/80 px-3 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-2 backdrop-blur-xl backdrop-saturate-150 md:hidden">
          <div className="flex min-w-0 items-center gap-1.5">
            <NavLink to="/" aria-label={t('app.name')} className="shrink-0 p-1">
              <BrandMark className="size-7" />
            </NavLink>
            <CompanySwitcher className="min-w-0" />
          </div>
          <LanguageSwitcher />
        </header>

        <main className="w-full flex-1 px-4 pt-5 pb-28 md:px-8 md:pt-8 md:pb-10 xl:px-10">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav
          aria-label="bottom navigation"
          className="pb-safe fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-border/60 bg-card/85 backdrop-blur-xl backdrop-saturate-150 md:hidden"
        >
          {[...NAV_ITEMS.filter((i) => i.mobile), MENU_ITEM].map(({ to, labelKey, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-0.5 pt-2 pb-1.5 text-[11px] font-medium text-muted-foreground transition-colors',
                  isActive && 'text-brand-strong',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'flex h-7 w-12 items-center justify-center rounded-full transition-colors',
                      isActive && 'bg-accent',
                    )}
                  >
                    <Icon className={cn('size-5', isActive && 'text-brand')} />
                  </span>
                  {t(labelKey)}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
