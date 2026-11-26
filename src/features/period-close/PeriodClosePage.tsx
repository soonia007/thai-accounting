import { CheckCircle2, Lock, LockOpen, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AccountingTabs } from '@/features/accounts/AccountingTabs'
import { dbErrorMessage } from '@/features/accounts/errors'
import { useCompany } from '@/features/company/CompanyProvider'
import { monthLabel, previousMonth, shiftMonth } from '@/features/vat/month'
import { formatDate, formatMoney, todayBangkok } from '@/lib/format'
import { canEditFinanceSetup } from '@/lib/permissions'
import { useChecklist, useCloseAction, useCloses, useYearPreview, type CheckItem } from './queries'

const LINKS: Record<CheckItem['key'], string> = {
  drafts: '/sales',
  bank: '/accounting/bank-reconciliation',
  depreciation: '/accounting/fixed-assets',
  vat: '/reports/vat',
  balanced: '/reports/trial-balance',
}

/** Day after a YYYY-MM-DD date, as the first of the next month (locked_through is a month end). */
const monthAfter = (d: string) => shiftMonth(d.slice(0, 7) + '-01', 1)

/** M15: month-end close checklist, lock/unlock, fiscal-year close. */
export function PeriodClosePage() {
  const { t, i18n } = useTranslation()
  const { current } = useCompany()
  const co = current!
  const era = co.date_era
  const lang = i18n.language
  const canClose = canEditFinanceSetup(co.role)
  const isOwner = co.role === 'owner'
  const locked = co.locked_through
  const today = todayBangkok()
  const lastEnded = previousMonth(today)
  const [pick, setPick] = useState(lastEnded.slice(0, 7))
  const next = locked ? monthAfter(locked) : pick + '-01'
  const nextEnded = next <= lastEnded
  const check = useChecklist(co.id, nextEnded ? next : null)
  const history = useCloses(co.id)
  const year = useYearPreview(co.id, locked)
  const action = useCloseAction()
  const [error, setError] = useState<unknown>(null)
  const [done, setDone] = useState<string | null>(null)

  const run = async (fn: string, args: Record<string, unknown>, msg: string) => {
    setError(null)
    setDone(null)
    try {
      await action.mutateAsync({ fn, args: { p_company_id: co.id, ...args } })
      setDone(msg)
    } catch (e) {
      setError(e)
    }
  }
  const items = check.data ?? []
  const warnings = items.filter((i) => !i.ok && (i.key !== 'vat' || i.applies))
  const closeMonth = () => {
    if (warnings.length && !window.confirm(t('close.confirmWarnings', { count: warnings.length })))
      return
    void run(
      'close_period',
      { p_month: next },
      t('close.closedOk', { month: monthLabel(next, era, lang) }),
    )
  }
  const reopen = (month: string) => {
    const reason = window.prompt(t('close.reopenReason', { month: monthLabel(month, era, lang) }))
    if (!reason?.trim()) return
    void run('reopen_period', { p_month: month, p_reason: reason.trim() }, t('close.reopenedOk'))
  }
  const y = year.data
  const reopenYear = () => {
    if (!y) return
    const reason = window.prompt(t('close.yearReopenReason'))
    if (!reason?.trim()) return
    void run(
      'reopen_fiscal_year',
      { p_year_end: y.year_end, p_reason: reason.trim() },
      t('close.reopenedOk'),
    )
  }
  const openCloses = (history.data ?? []).filter((h) => !h.reopened_at)

  return (
    <div className="space-y-6">
      <AccountingTabs />
      <PageHeader title={t('close.title')} description={t('close.subtitle')} />
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{dbErrorMessage(t, error)}</AlertDescription>
        </Alert>
      ) : null}
      {done ? (
        <Alert>
          <AlertDescription>{done}</AlertDescription>
        </Alert>
      ) : null}

      <section className="flex items-center gap-3 rounded-lg border p-4">
        {locked ? (
          <Lock className="size-5 text-primary" />
        ) : (
          <LockOpen className="size-5 text-muted-foreground" />
        )}
        <div>
          <p className="font-medium">
            {locked
              ? t('close.lockedThrough', { date: formatDate(locked, era) })
              : t('close.nothingLocked')}
          </p>
          <p className="text-sm text-muted-foreground">{t('close.lockExplain')}</p>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-semibold">
          {t('close.nextTitle', { month: monthLabel(next, era, lang) })}
        </h2>
        {!locked ? (
          <div className="grid max-w-xs gap-2">
            <label htmlFor="close-first" className="text-sm">
              {t('close.firstMonth')}
            </label>
            <Input
              id="close-first"
              type="month"
              value={pick}
              max={lastEnded.slice(0, 7)}
              onChange={(e) => e.target.value && setPick(e.target.value)}
            />
          </div>
        ) : null}
        {!nextEnded ? (
          <p className="text-sm text-muted-foreground">{t('close.notEnded')}</p>
        ) : (
          <>
            <ul className="space-y-2">
              {items.map((i) => {
                const skip = i.key === 'vat' && !i.applies
                return (
                  <li key={i.key} className="flex items-start gap-2 text-sm">
                    {i.ok || skip ? (
                      <CheckCircle2 className="mt-0.5 size-4 text-emerald-600" />
                    ) : (
                      <TriangleAlert className="mt-0.5 size-4 text-amber-600" />
                    )}
                    <span className="flex-1">
                      {t(`close.check.${i.key}`)}
                      {!i.ok && !skip ? (
                        <>
                          {' — '}
                          <span className="text-muted-foreground">
                            {t(`close.fix.${i.key}`, {
                              count: i.count ?? 0,
                              amount: formatMoney(i.amount ?? 0, lang),
                            })}
                          </span>{' '}
                          <Link to={LINKS[i.key]} className="text-primary underline">
                            {t('close.goFix')}
                          </Link>
                        </>
                      ) : null}
                    </span>
                  </li>
                )
              })}
            </ul>
            {canClose ? (
              <Button onClick={closeMonth} disabled={action.isPending || check.isLoading}>
                <Lock className="size-4" />
                {t('close.closeButton', { month: monthLabel(next, era, lang) })}
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">{t('close.noPermission')}</p>
            )}
          </>
        )}
      </section>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-semibold">{t('close.yearTitle')}</h2>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label htmlFor="fy-start">{t('close.yearStart')}</label>
          <select
            id="fy-start"
            className="h-9 rounded-md border bg-background px-2"
            value={co.fiscal_year_start_month}
            disabled={!(isOwner || co.role === 'admin') || action.isPending}
            onChange={(e) =>
              void run(
                'set_fiscal_year_start',
                { p_month: Number(e.target.value) },
                t('close.yearStartSaved'),
              )
            }
          >
            {Array.from({ length: 12 }, (_, m) => (
              <option key={m} value={m + 1}>
                {new Date(2000, m, 1).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US', {
                  month: 'long',
                })}
              </option>
            ))}
          </select>
        </div>
        {y ? (
          <div className="space-y-2 text-sm">
            <p>
              {t('close.yearRange', {
                from: formatDate(y.year_start, era),
                to: formatDate(y.year_end, era),
              })}{' '}
              {y.closed ? <Badge>{t('close.yearClosed')}</Badge> : null}
            </p>
            <p>
              {t('close.netProfit')}: <strong>{formatMoney(y.net_profit, lang)}</strong>
            </p>
            {y.closed ? (
              isOwner ? (
                <Button variant="outline" onClick={reopenYear} disabled={action.isPending}>
                  <LockOpen className="size-4" />
                  {t('close.yearReopen')}
                </Button>
              ) : null
            ) : y.months_closed ? (
              canClose ? (
                <Button
                  onClick={() =>
                    window.confirm(
                      t('close.yearConfirm', { amount: formatMoney(y.net_profit, lang) }),
                    ) &&
                    void run(
                      'close_fiscal_year',
                      { p_year_end: y.year_end },
                      t('close.yearClosedOk'),
                    )
                  }
                  disabled={action.isPending}
                >
                  <Lock className="size-4" />
                  {t('close.yearClose')}
                </Button>
              ) : null
            ) : (
              <p className="text-muted-foreground">{t('close.yearNeedMonths')}</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('close.yearNeedMonths')}</p>
        )}
      </section>

      <section className="space-y-2 rounded-lg border p-4">
        <h2 className="font-semibold">{t('close.history')}</h2>
        {(history.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('close.historyEmpty')}</p>
        ) : (
          <ul className="divide-y text-sm">
            {(history.data ?? []).map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="w-32 font-medium">{monthLabel(h.month, era, lang)}</span>
                {h.reopened_at ? (
                  <Badge variant="outline">
                    {t('close.reopenedBadge', { reason: h.reopen_reason ?? '' })}
                  </Badge>
                ) : (
                  <Badge>{t('close.closedBadge')}</Badge>
                )}
                <span className="flex-1 text-muted-foreground">
                  {formatDate(h.closed_at.slice(0, 10), era)}
                </span>
                {isOwner && !h.reopened_at && openCloses.length ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => reopen(h.month)}
                    disabled={action.isPending}
                  >
                    <LockOpen className="size-4" />
                    {t('close.reopen')}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
