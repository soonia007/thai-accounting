import { useQuery } from '@tanstack/react-query'
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  BookOpen,
  BookText,
  CircleDollarSign,
  FilePlus2,
  FileText,
  FlaskConical,
  Landmark,
  LayoutDashboard,
  Package,
  Receipt,
  ShoppingCart,
  type LucideIcon,
  Users,
  Wallet,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AnimatedMoney } from '@/components/AnimatedNumber'
import { PageHeader } from '@/components/PageHeader'
import { useCompany } from '@/features/company/CompanyProvider'
import { MyInvitations } from '@/features/company/MyInvitations'
import { formatMoney } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

interface MonthRow {
  month: string
  revenue: number
  expenses: number
}
interface Summary {
  months: MonthRow[]
  cash: number
  receivables: number
  payables: number
  overdue: { count: number; amount: number }
}

type Range = 6 | 12
type ChartMode = 'flow' | 'profit'

function useDashboard(companyId: string, months: Range) {
  return useQuery({
    queryKey: ['dashboard', companyId, months],
    queryFn: async (): Promise<Summary> => {
      const { data, error } = await supabase.rpc('dashboard_summary', {
        p_company_id: companyId,
        p_months: months,
      })
      if (error) throw error
      const d = data as unknown as Summary
      return {
        ...d,
        cash: Number(d.cash),
        receivables: Number(d.receivables),
        payables: Number(d.payables),
        overdue: { count: Number(d.overdue.count), amount: Number(d.overdue.amount) },
        months: d.months.map((m) => ({
          month: m.month,
          revenue: Number(m.revenue),
          expenses: Number(m.expenses),
        })),
      }
    },
    placeholderData: (prev) => prev,
  })
}

/** iOS-style segmented control. */
function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-full bg-muted p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'h-8 cursor-pointer rounded-full px-3.5 text-xs font-semibold text-muted-foreground transition-all duration-300',
            value === o.value && 'bg-card text-foreground shadow-card',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function change(now: number, before: number) {
  if (before === 0) return null
  return ((now - before) / Math.abs(before)) * 100
}

function Kpi({
  icon: Icon,
  label,
  value,
  delta,
  goodWhenUp = true,
  note,
  tone = 'brand',
}: {
  icon: LucideIcon
  label: string
  value: number
  delta?: number | null
  goodWhenUp?: boolean
  note?: React.ReactNode
  tone?: 'brand' | 'mint' | 'warn'
}) {
  const { t, i18n } = useTranslation()
  const up = (delta ?? 0) >= 0
  const good = up === goodWhenUp
  return (
    <div className="group flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-5 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-raised">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span
          className={cn(
            'flex size-9 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110',
            tone === 'brand' && 'bg-accent text-brand',
            tone === 'mint' && 'bg-finora-mint/15 text-[#0b8a7a]',
            tone === 'warn' && 'bg-warning/15 text-warning-foreground',
          )}
        >
          <Icon className="size-[18px]" />
        </span>
      </div>
      <AnimatedMoney
        value={value}
        lang={i18n.language}
        countFromZero
        className="text-[26px] leading-none font-semibold tracking-tight"
      />
      <div className="flex min-h-5 items-center gap-2 text-xs">
        {delta !== undefined && delta !== null && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-semibold',
              good
                ? 'bg-success/12 text-success-foreground'
                : 'bg-destructive/10 text-destructive-foreground',
            )}
          >
            {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
        {delta !== undefined && delta !== null && (
          <span className="text-muted-foreground">{t('dashboard.vsLastMonth')}</span>
        )}
        {note}
      </div>
    </div>
  )
}

/** Tooltip card: month, both series (colour swatch + text in text ink) and the result. */
interface TipProps {
  active?: boolean
  payload?: readonly { payload?: unknown }[]
  label?: string | number
}
function ChartTooltip({ active, payload, label }: TipProps) {
  const { t, i18n } = useTranslation()
  if (!active || !payload?.length) return null
  const row = payload[0].payload as MonthRow & { label: string }
  const profit = row.revenue - row.expenses
  const line = (color: string, name: string, v: number) => (
    <div className="flex items-center justify-between gap-6">
      <span className="flex items-center gap-2 text-muted-foreground">
        <span className="size-2.5 rounded-sm" style={{ background: color }} />
        {name}
      </span>
      <span className="font-medium tabular-nums">{formatMoney(v, i18n.language)}</span>
    </div>
  )
  return (
    <div className="min-w-52 rounded-xl border border-border/70 bg-card/95 p-3 text-sm shadow-raised backdrop-blur">
      <div className="mb-2 font-semibold">{label}</div>
      <div className="flex flex-col gap-1">
        {line('var(--chart-1)', t('dashboard.revenue'), row.revenue)}
        {line('var(--chart-2)', t('dashboard.expenses'), row.expenses)}
      </div>
      <div className="mt-2 flex items-center justify-between gap-6 border-t pt-2">
        <span className="text-muted-foreground">{t('dashboard.profit')}</span>
        <span
          className={cn(
            'font-semibold tabular-nums',
            profit < 0 ? 'text-destructive-foreground' : 'text-success-foreground',
          )}
        >
          {formatMoney(profit, i18n.language)}
        </span>
      </div>
    </div>
  )
}

function Legend() {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm bg-chart-1" />
        {t('dashboard.revenue')}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm bg-chart-2" />
        {t('dashboard.expenses')}
      </span>
    </div>
  )
}

export function DashboardPage() {
  const { t, i18n } = useTranslation()
  const { current } = useCompany()
  const [range, setRange] = useState<Range>(12)
  const [mode, setMode] = useState<ChartMode>('flow')
  const summary = useDashboard(current!.id, range)
  const d = summary.data

  const monthFmt = new Intl.DateTimeFormat(i18n.language === 'en' ? 'en-US' : 'th-TH', {
    month: 'short',
  })
  const rows = (d?.months ?? []).map((m) => ({
    ...m,
    profit: m.revenue - m.expenses,
    label: monthFmt.format(new Date(`${m.month}-01T00:00:00`)),
  }))
  const thisM = rows.at(-1)
  const lastM = rows.at(-2)
  const hasData = rows.some((r) => r.revenue !== 0 || r.expenses !== 0)
  const axisMoney = (v: number) =>
    new Intl.NumberFormat(i18n.language === 'en' ? 'en-US' : 'th-TH', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(v)

  const quickGroups: {
    key: 'sales' | 'purchases' | 'books'
    icon: LucideIcon
    tint: string
    items: { to: string; icon: LucideIcon; label: string }[]
  }[] = [
    {
      key: 'sales',
      icon: Receipt,
      tint: 'bg-accent text-brand',
      items: [
        { to: '/sales/new/quotation', icon: FileText, label: t('docTypes.quotation') },
        { to: '/sales/new/invoice', icon: FilePlus2, label: t('docTypes.invoice') },
        { to: '/sales/new/cash_sale', icon: Banknote, label: t('docTypes.cash_sale') },
        { to: '/sales/payments/new', icon: CircleDollarSign, label: t('docs.newPayment.sales') },
      ],
    },
    {
      key: 'purchases',
      icon: ShoppingCart,
      tint: 'bg-finora-mint/15 text-[#0b8a7a]',
      items: [
        {
          to: '/purchases/new/purchase_order',
          icon: FileText,
          label: t('docTypes.purchase_order'),
        },
        { to: '/purchases/new/bill', icon: FilePlus2, label: t('docTypes.bill') },
        { to: '/purchases/new/cash_purchase', icon: Banknote, label: t('docTypes.cash_purchase') },
        {
          to: '/purchases/payments/new',
          icon: CircleDollarSign,
          label: t('docs.newPayment.purchases'),
        },
      ],
    },
    {
      key: 'books',
      icon: BookOpen,
      tint: 'bg-muted text-brand-mid',
      items: [
        { to: '/accounting/journal/new', icon: BookText, label: t('journal.new') },
        { to: '/contacts', icon: Users, label: t('nav.contacts') },
        { to: '/products', icon: Package, label: t('nav.products') },
      ],
    },
  ]

  return (
    <div className="flex w-full flex-col gap-6">
      <MyInvitations />
      <PageHeader
        icon={LayoutDashboard}
        section={t('sections.overview')}
        title={t('hello.title')}
        description={
          <>
            {t('hello.workingIn', { company: current?.name })} ·{' '}
            {current && t(`roles.${current.role}`)} — {t('pageInfo.dashboard')}
          </>
        }
      />

      {/* Quick actions, grouped by area of work */}
      <section aria-label={t('dashboard.quickActions')} className="grid gap-3 md:grid-cols-3">
        {quickGroups.map((g) => (
          <div
            key={g.key}
            className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-card"
          >
            <div className="flex items-center gap-2.5">
              <span className={cn('flex size-8 items-center justify-center rounded-xl', g.tint)}>
                <g.icon className="size-4" />
              </span>
              <div>
                <div className="text-sm font-semibold">{t(`dashboard.groups.${g.key}`)}</div>
                <div className="text-xs text-muted-foreground">
                  {t(`dashboard.groupsInfo.${g.key}`)}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {g.items.map((a) => (
                <Link
                  key={a.to}
                  to={a.to}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border bg-card px-3 text-xs font-medium shadow-xs transition-all hover:-translate-y-px hover:border-brand hover:text-brand-strong"
                >
                  <a.icon className="size-3.5 text-brand" />
                  {a.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* KPI tiles — numbers count up when loaded and when the data changes */}
      <section
        aria-label={t('dashboard.thisMonth')}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <Kpi
          icon={ArrowUpRight}
          label={t('dashboard.revenueThisMonth')}
          value={thisM?.revenue ?? 0}
          delta={thisM && lastM ? change(thisM.revenue, lastM.revenue) : null}
        />
        <Kpi
          icon={ArrowDownRight}
          tone="mint"
          label={t('dashboard.expensesThisMonth')}
          value={thisM?.expenses ?? 0}
          delta={thisM && lastM ? change(thisM.expenses, lastM.expenses) : null}
          goodWhenUp={false}
        />
        <Kpi
          icon={Wallet}
          label={t('dashboard.cash')}
          value={d?.cash ?? 0}
          note={<span className="text-muted-foreground">{t('dashboard.cashNote')}</span>}
        />
        <Kpi
          icon={Landmark}
          tone={d && d.overdue.count > 0 ? 'warn' : 'brand'}
          label={t('dashboard.receivables')}
          value={d?.receivables ?? 0}
          note={
            d && d.overdue.count > 0 ? (
              <Link
                to="/sales?tab=invoice"
                className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 font-semibold text-destructive-foreground"
              >
                <span className="size-1.5 rounded-full bg-destructive" />
                {t('dashboard.overdue', {
                  count: d.overdue.count,
                  amount: formatMoney(d.overdue.amount, i18n.language),
                })}
              </Link>
            ) : (
              <span className="text-muted-foreground">
                {t('dashboard.payables')} {formatMoney(d?.payables ?? 0, i18n.language)}
              </span>
            )
          }
        />
      </section>

      {/* Chart with hover tooltips; toggles switch range and view */}
      <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight">
              {mode === 'flow' ? t('dashboard.chartFlow') : t('dashboard.chartProfit')}
            </h2>
            <p className="text-xs text-muted-foreground">{t('dashboard.chartHint')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              label={t('dashboard.view')}
              value={mode}
              onChange={setMode}
              options={[
                { value: 'flow', label: t('dashboard.modeFlow') },
                { value: 'profit', label: t('dashboard.modeProfit') },
              ]}
            />
            <Segmented
              label={t('dashboard.range')}
              value={range}
              onChange={setRange}
              options={[
                { value: 6, label: t('dashboard.months', { count: 6 }) },
                { value: 12, label: t('dashboard.months', { count: 12 }) },
              ]}
            />
          </div>
        </div>
        {mode === 'flow' && hasData && <Legend />}
        <div
          className={cn(
            'mt-3 h-72 transition-opacity duration-300',
            summary.isFetching && 'opacity-60',
          )}
        >
          {!hasData && !summary.isLoading ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-center text-sm text-muted-foreground">
              {t('dashboard.empty')}
              <Link to="/sales/new/invoice" className="font-medium text-primary hover:underline">
                {t('dashboard.emptyCta')}
              </Link>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {mode === 'flow' ? (
                <BarChart
                  data={rows}
                  barGap={2}
                  barCategoryGap="28%"
                  margin={{ left: 4, right: 4 }}
                >
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                  />
                  <YAxis
                    tickFormatter={axisMoney}
                    tickLine={false}
                    axisLine={false}
                    width={52}
                    tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                  />
                  <Tooltip
                    content={(p) => (
                      <ChartTooltip active={p.active} payload={p.payload} label={p.label} />
                    )}
                    cursor={{ fill: 'var(--accent)', opacity: 0.7, radius: 8 } as object}
                  />
                  <Bar
                    dataKey="revenue"
                    fill="var(--chart-1)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                    animationDuration={700}
                  />
                  <Bar
                    dataKey="expenses"
                    fill="var(--chart-2)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                    animationDuration={700}
                  />
                </BarChart>
              ) : (
                <AreaChart data={rows} margin={{ left: 4, right: 4 }}>
                  <defs>
                    <linearGradient id="profit-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                  />
                  <YAxis
                    tickFormatter={axisMoney}
                    tickLine={false}
                    axisLine={false}
                    width={52}
                    tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                  />
                  <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeOpacity={0.5} />
                  <Tooltip
                    content={(p) => (
                      <ChartTooltip active={p.active} payload={p.payload} label={p.label} />
                    )}
                    cursor={{ stroke: 'var(--brand)', strokeWidth: 1 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="profit"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    fill="url(#profit-fill)"
                    dot={{ r: 4, fill: 'var(--card)', stroke: 'var(--chart-1)', strokeWidth: 2 }}
                    activeDot={{
                      r: 6,
                      fill: 'var(--chart-1)',
                      stroke: 'var(--card)',
                      strokeWidth: 2,
                    }}
                    animationDuration={700}
                  />
                </AreaChart>
              )}
            </ResponsiveContainer>
          )}
        </div>
        {/* Accessible table view of the same numbers */}
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
            {t('dashboard.showTable')}
          </summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-1.5 text-left font-medium">{t('dashboard.month')}</th>
                  <th className="py-1.5 font-medium">{t('dashboard.revenue')}</th>
                  <th className="py-1.5 font-medium">{t('dashboard.expenses')}</th>
                  <th className="py-1.5 font-medium">{t('dashboard.profit')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.month} className="border-t border-border/60">
                    <td className="py-1.5 text-left">
                      {r.label} {r.month.slice(0, 4)}
                    </td>
                    <td className="py-1.5">{formatMoney(r.revenue, i18n.language)}</td>
                    <td className="py-1.5">{formatMoney(r.expenses, i18n.language)}</td>
                    <td className="py-1.5">{formatMoney(r.profit, i18n.language)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      {/* Sandbox teaser */}
      <Link
        to="/sandbox"
        className="group relative flex flex-col gap-3 overflow-hidden rounded-2xl bg-gradient-to-br from-finora-cobalt via-[#0b5fd0] to-finora-sky p-6 text-white shadow-raised transition-transform duration-300 hover:-translate-y-0.5 sm:flex-row sm:items-center sm:justify-between"
      >
        <div
          aria-hidden
          className="absolute -top-16 -right-10 size-56 rounded-full bg-finora-mint/40 blur-3xl"
        />
        <div className="relative flex items-center gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
            <FlaskConical className="size-6" />
          </span>
          <div>
            <div className="text-lg font-semibold">{t('sandbox.title')}</div>
            <div className="text-sm text-white/80">{t('sandbox.teaser')}</div>
          </div>
        </div>
        <span className="relative inline-flex h-10 items-center gap-1.5 self-start rounded-full bg-white px-5 text-sm font-semibold text-finora-cobalt sm:self-auto">
          {t('sandbox.open')}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </Link>
    </div>
  )
}
