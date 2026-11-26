import { CalendarClock, CheckCircle2, Hourglass } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { monthLabel } from '@/features/vat/month'
import { useCompany } from '@/features/company/CompanyProvider'
import { formatDate, formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'

export interface AgingSide {
  current: number
  d30: number
  d60: number
  d90: number
  over90: number
  count: number
  overdue_count: number
}
export interface TaxDue {
  company_id: string
  company: string
  form: 'pp30' | 'pnd3' | 'pnd53'
  amount: number
  filed: boolean | null
  due: string
  due_efiling: string
}

const BUCKETS = ['current', 'd30', 'd60', 'd90', 'over90'] as const
const TONES = ['bg-chart-1', 'bg-finora-mint', 'bg-warning', 'bg-orange-500', 'bg-destructive']

/** Receivables or payables split by days past due, as a stacked bar + list. */
export function AgingCard({ side, data }: { side: 'ar' | 'ap'; data: AgingSide | undefined }) {
  const { t, i18n } = useTranslation()
  const values = BUCKETS.map((b) => Number(data?.[b] ?? 0))
  const total = values.reduce((a, b) => a + b, 0)
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-5 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold tracking-tight">{t(`dashboard.aging.${side}`)}</h2>
        <Link
          to={
            side === 'ar'
              ? '/reports/receivables-payables'
              : '/reports/receivables-payables?side=ap'
          }
          className="text-xs font-medium text-primary hover:underline"
        >
          {t('dashboard.aging.detail')}
        </Link>
      </div>
      <div className="text-2xl font-semibold tabular-nums">{formatMoney(total, i18n.language)}</div>
      {total > 0 ? (
        <div className="flex h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          {values.map((v, i) =>
            v > 0 ? (
              <span key={i} className={TONES[i]} style={{ width: `${(v / total) * 100}%` }} />
            ) : null,
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t('dashboard.aging.none')}</p>
      )}
      <ul className="space-y-1 text-sm">
        {BUCKETS.map((b, i) => (
          <li key={b} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className={cn('size-2.5 rounded-sm', TONES[i])} />
              {t(`dashboard.aging.${b}`)}
            </span>
            <span
              className={cn(
                'tabular-nums',
                i >= 3 && values[i] > 0 && 'font-semibold text-destructive',
              )}
            >
              {formatMoney(values[i], i18n.language)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Returns due this month for last month, with estimated amounts. */
export function TaxDueCard({
  month,
  items,
  multi,
}: {
  month: string
  items: TaxDue[]
  multi: boolean
}) {
  const { t, i18n } = useTranslation()
  const { current } = useCompany()
  const era = current!.date_era
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-5 shadow-card">
      <div>
        <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
          <CalendarClock className="size-4 text-brand" />
          {t('dashboard.tax.title')}
        </h2>
        <p className="text-xs text-muted-foreground">
          {t('dashboard.tax.hint', { month: monthLabel(`${month}-01`, era, i18n.language) })}
        </p>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('dashboard.tax.none')}</p>
      ) : (
        <ul className="divide-y text-sm">
          {items.map((x) => (
            <li
              key={`${x.company_id}-${x.form}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2"
            >
              <span className="min-w-28 font-medium">
                {t(`dashboard.tax.forms.${x.form}`)}
                {multi ? (
                  <span className="block text-xs font-normal text-muted-foreground">
                    {x.company}
                  </span>
                ) : null}
              </span>
              <span className="flex-1 text-xs text-muted-foreground">
                {t('dashboard.tax.due', {
                  paper: formatDate(x.due, era),
                  efiling: formatDate(x.due_efiling, era),
                })}
              </span>
              <span className="tabular-nums">
                {Number(x.amount) < 0
                  ? t('dashboard.tax.refund', {
                      amount: formatMoney(-Number(x.amount), i18n.language),
                    })
                  : formatMoney(Number(x.amount), i18n.language)}
              </span>
              {x.filed ? (
                <span className="inline-flex items-center gap-1 text-xs text-success-foreground">
                  <CheckCircle2 className="size-3.5" />
                  {t('dashboard.tax.filed')}
                </span>
              ) : (
                <Link
                  to={x.form === 'pp30' ? '/reports/vat' : '/reports/wht'}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <Hourglass className="size-3.5" />
                  {t('dashboard.tax.open')}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">{t('dashboard.tax.estimate')}</p>
    </div>
  )
}
