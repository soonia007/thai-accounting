import { ArrowLeft, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Every page opens the same way: section (where you are) · title (what this page is) ·
 * one line on what it is for · actions grouped by purpose on the right.
 */
export function PageHeader({
  icon: Icon,
  section,
  title,
  description,
  actions,
  backTo,
  badges,
  className,
}: {
  icon?: LucideIcon
  /** the area of the app, e.g. "Sales" — shown above the title */
  section?: string
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  backTo?: string
  /** status chips shown next to the title */
  badges?: ReactNode
  className?: string
}) {
  const { t } = useTranslation()
  return (
    <header className={cn('flex flex-wrap items-start justify-between gap-x-6 gap-y-4', className)}>
      <div className="flex min-w-0 items-start gap-3.5">
        {backTo ? (
          <Button
            variant="ghost"
            size="icon"
            asChild
            aria-label={t('common.back')}
            className="-ml-2 shrink-0"
          >
            <Link to={backTo}>
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
        ) : Icon ? (
          <span className="mt-0.5 hidden size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-finora-sky to-finora-cobalt text-white shadow-raised sm:flex">
            <Icon className="size-5" />
          </span>
        ) : null}
        <div className="min-w-0">
          {section && (
            <div className="mb-0.5 text-xs font-semibold tracking-[0.08em] text-brand uppercase">
              {section}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-balance md:text-[28px]">
              {title}
            </h1>
            {badges}
          </div>
          {description && (
            <p className="mt-1 max-w-3xl text-sm text-pretty text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-end gap-3">{actions}</div>}
    </header>
  )
}

/** A labelled cluster of related buttons, e.g. "Create" · "Money" · "Data". */
export function ActionGroup({
  label,
  children,
  className,
}: {
  label?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div role="group" aria-label={label} className={cn('flex flex-col gap-1', className)}>
      {label && (
        <span className="px-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          {label}
        </span>
      )}
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}
