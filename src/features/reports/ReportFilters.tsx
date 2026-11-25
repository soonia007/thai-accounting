import { Building2, CalendarRange, ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { useCompany } from '@/features/company/CompanyProvider'
import { cn } from '@/lib/utils'
import { matchPreset, PERIOD_PRESETS } from './period'
import type { ReportScope } from './scope'

/** Company scope (one company or several, combined) + period / as-of date. */
export function ReportFilters({
  scope,
  mode,
  children,
}: {
  scope: ReportScope
  mode: 'period' | 'asOf'
  children?: React.ReactNode
}) {
  const { t } = useTranslation()
  const { companies } = useCompany()
  const active = matchPreset(scope.from, scope.to, scope.today)
  const label =
    scope.companyIds.length === 1
      ? (companies.find((c) => c.id === scope.companyIds[0])?.name ?? '')
      : t('reports.combinedCount', { count: scope.companyIds.length })

  const toggle = (id: string, on: boolean) => {
    const next = on ? [...scope.companyIds, id] : scope.companyIds.filter((x) => x !== id)
    if (next.length > 0) scope.setCompanies(next) // never empty: a report needs a company
  }

  return (
    <section
      aria-label={t('reports.filters')}
      className="flex flex-wrap items-end gap-x-5 gap-y-3 rounded-2xl border border-border/70 bg-card p-4 shadow-card"
    >
      {companies.length > 1 && (
        <div className="flex flex-col gap-1">
          <span className="px-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            {t('reports.companies')}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="max-w-64 justify-between gap-2">
                <Building2 className="size-4 text-brand" />
                <span className="truncate">{label}</span>
                <ChevronDown className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                {t('reports.combinedHint')}
              </DropdownMenuLabel>
              {companies.map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.id}
                  checked={scope.companyIds.includes(c.id)}
                  onCheckedChange={(on) => toggle(c.id, on)}
                  onSelect={(e) => e.preventDefault()}
                >
                  {c.name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {mode === 'period' ? (
        <>
          <div className="flex flex-col gap-1">
            <span className="px-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              {t('reports.period')}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <CalendarRange className="size-4 text-brand" />
              <Input
                type="date"
                aria-label={t('reports.from')}
                className="h-9 w-40"
                value={scope.from}
                max={scope.to}
                onChange={(e) => e.target.value && scope.setRange(e.target.value, scope.to)}
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="date"
                aria-label={t('reports.to')}
                className="h-9 w-40"
                value={scope.to}
                min={scope.from}
                onChange={(e) => e.target.value && scope.setRange(scope.from, e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-1 rounded-full bg-muted p-1" role="group">
            {PERIOD_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={active === p}
                onClick={() => scope.applyPreset(p)}
                className={cn(
                  'h-7 cursor-pointer rounded-full px-3 text-xs font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground',
                  active === p && 'bg-card text-foreground shadow-card',
                )}
              >
                {t(`reports.presets.${p}`)}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-1">
          <span className="px-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            {t('reports.asOf')}
          </span>
          <div className="flex items-center gap-2">
            <CalendarRange className="size-4 text-brand" />
            <Input
              type="date"
              aria-label={t('reports.asOf')}
              className="h-9 w-40"
              value={scope.to}
              onChange={(e) => e.target.value && scope.setAsOf(e.target.value)}
            />
            <Button variant="ghost" size="sm" onClick={() => scope.setAsOf(scope.today)}>
              {t('reports.today')}
            </Button>
          </div>
        </div>
      )}
      {children}
    </section>
  )
}
