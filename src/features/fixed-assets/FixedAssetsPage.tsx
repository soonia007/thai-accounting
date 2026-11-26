import { Building, CalendarCheck, FileDown, Plus, Sheet, Sparkles, Undo2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { ActionGroup, PageHeader } from '@/components/PageHeader'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AccountingTabs } from '@/features/accounts/AccountingTabs'
import { dbErrorMessage } from '@/features/accounts/errors'
import { useAccounts } from '@/features/accounts/queries'
import { useCompany } from '@/features/company/CompanyProvider'
import { exportReportPdf } from '@/features/reports/export-pdf'
import { exportXlsx } from '@/features/reports/export-xlsx'
import { monthLabel } from '@/features/vat/month'
import { formatDate, formatMoney, todayBangkok } from '@/lib/format'
import { canEditFinanceSetup } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { AssetDialog } from './AssetDialog'
import { buildRegister, pendingMonths, type AssetRow } from './model'
import {
  useAssets,
  useCategories,
  useDepreciationPreview,
  usePendingLines,
  useRunDepreciation,
  useRuns,
  useSaveCategory,
  useVoidRun,
} from './queries'
import { RegisterDialog } from './RegisterDialog'

/** M14: register, one-click monthly depreciation, disposal. */
export function FixedAssetsPage() {
  const { t, i18n } = useTranslation()
  const { current } = useCompany()
  const co = current!
  const era = co.date_era
  const canEdit = canEditFinanceSetup(co.role)
  const money = (v: number) => formatMoney(v, i18n.language)
  const [params, setParams] = useSearchParams()
  const today = todayBangkok()
  const assets = useAssets(co.id, '9999-12-31')
  const categories = useCategories(co.id, canEdit)
  const pending = usePendingLines(co.id)
  const runs = useRuns(co.id)
  const [registerOpen, setRegisterOpen] = useState(!!params.get('register'))
  const [selected, setSelected] = useState<AssetRow | null>(null)
  const [showDisposed, setShowDisposed] = useState(false)
  const [busy, setBusy] = useState(false)

  const rows = assets.data ?? []
  const active = rows.filter((r) => r.status === 'active')
  const posted = (runs.data ?? []).filter((r) => r.status === 'posted')
  const lastRun = posted[0]?.month ?? null
  const firstStart = active.length ? active.map((r) => r.acquired_on).sort()[0] : null
  const months = pendingMonths(lastRun, firstStart, today)
  const nextMonth = months[0] ?? null
  const preview = useDepreciationPreview(co.id, nextMonth)
  const previewTotal = (preview.data ?? []).reduce((s, r) => s + Number(r.amount), 0)
  const run = useRunDepreciation(co.id)
  const voidRun = useVoidRun(co.id)
  const L = useMemo(
    () =>
      Object.fromEntries(
        [
          'code',
          'name',
          'category',
          'acquired',
          'cost',
          'accum',
          'nbv',
          'status',
          'disposed',
          'total',
        ].map((k) => [k, (t as (k: string) => string)(`fa.registerReport.${k}`)]),
      ) as never,
    [t],
  )
  const table = buildRegister(showDisposed ? rows : active, L)
  const meta = {
    title: t('fa.registerReport.title'),
    companies: [co.name],
    period: `${t('reports.asOf')} ${formatDate(today, era)}`,
    fileBase: `fixed-assets-${today}`,
    lang: i18n.language,
    era,
  }
  const exportAs = async (k: 'pdf' | 'xlsx') => {
    setBusy(true)
    try {
      if (k === 'pdf') await exportReportPdf(table, meta, co.logo_path)
      else await exportXlsx(table, meta)
    } finally {
      setBusy(false)
    }
  }
  const totals = {
    cost: active.reduce((s, r) => s + Number(r.cost), 0),
    nbv: active.reduce((s, r) => s + Number(r.cost) - Number(r.accum), 0),
    monthly: active.reduce((s, r) => s + Number(r.monthly), 0),
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <PageHeader
        icon={Building}
        section={t('nav.accounting')}
        title={t('fa.title')}
        description={t('fa.info')}
        actions={
          <>
            <ActionGroup label={t('actionGroups.export')}>
              <Button
                variant="outline"
                size="sm"
                disabled={busy || rows.length === 0}
                onClick={() => exportAs('pdf')}
              >
                <FileDown className="size-4" />
                PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={busy || rows.length === 0}
                onClick={() => exportAs('xlsx')}
              >
                <Sheet className="size-4" />
                Excel
              </Button>
            </ActionGroup>
            {canEdit && (
              <ActionGroup label={t('actionGroups.create')}>
                <Button size="sm" onClick={() => setRegisterOpen(true)}>
                  <Plus className="size-4" />
                  {t('fa.registerButton')}
                </Button>
              </ActionGroup>
            )}
          </>
        }
      />
      <AccountingTabs />

      {(pending.data?.length ?? 0) > 0 && canEdit && (
        <Alert>
          <Sparkles className="size-4" />
          <AlertDescription className="flex flex-wrap items-center gap-2">
            {t('fa.pendingPurchases', { count: pending.data!.length })}
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={() => setRegisterOpen(true)}
            >
              {t('fa.registerNow')}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {rows.length === 0 && assets.data ? (
        <section className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card p-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-accent text-brand">
            <Building className="size-6" />
          </span>
          <p className="font-medium">{t('fa.emptyTitle')}</p>
          <ol className="max-w-lg list-decimal text-left text-sm text-muted-foreground">
            <li>{t('fa.emptyStep1')}</li>
            <li>{t('fa.emptyStep2')}</li>
            <li>{t('fa.emptyStep3')}</li>
          </ol>
          {canEdit && (
            <Button onClick={() => setRegisterOpen(true)}>{t('fa.registerButton')}</Button>
          )}
        </section>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              [t('fa.tiles.count'), String(active.length)],
              [t('fa.tiles.cost'), money(totals.cost)],
              [t('fa.tiles.nbv'), money(totals.nbv)],
              [t('fa.tiles.monthly'), money(totals.monthly)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl border border-border/70 bg-card p-4 shadow-card">
                <div className="text-xs text-muted-foreground">{k}</div>
                <div className="text-xl font-semibold tabular-nums">{v}</div>
              </div>
            ))}
          </div>

          {/* monthly depreciation: one button */}
          <section className="flex flex-col gap-3 rounded-2xl border border-brand/20 bg-gradient-to-br from-accent via-card to-card p-5 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 font-semibold">
                  <CalendarCheck className="size-4 text-brand" />
                  {t('fa.dep.title')}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {nextMonth
                    ? t('fa.dep.next', {
                        month: monthLabel(nextMonth, era, i18n.language),
                        amount: money(previewTotal),
                        count: preview.data?.length ?? 0,
                      })
                    : t('fa.dep.upToDate')}
                  {months.length > 1 && ` ${t('fa.dep.behind', { count: months.length })}`}
                </p>
              </div>
              {canEdit && nextMonth && (
                <Button
                  disabled={run.isPending || previewTotal <= 0}
                  onClick={() => run.mutate(nextMonth)}
                >
                  {t('fa.dep.post', { month: monthLabel(nextMonth, era, i18n.language) })}
                </Button>
              )}
            </div>
            {(run.error != null || voidRun.error != null) && (
              <Alert variant="destructive">
                <AlertDescription>{dbErrorMessage(t, run.error ?? voidRun.error)}</AlertDescription>
              </Alert>
            )}
            {posted.length > 0 && (
              <ul className="flex flex-wrap gap-2 text-xs">
                {posted.slice(0, 6).map((r, i) => (
                  <li
                    key={r.id}
                    className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1"
                  >
                    {monthLabel(r.month, era, i18n.language)} · {money(Number(r.total))}
                    {i === 0 && canEdit && (
                      <button
                        type="button"
                        aria-label={t('fa.dep.undo')}
                        title={t('fa.dep.undo')}
                        className="cursor-pointer text-muted-foreground hover:text-destructive"
                        onClick={() =>
                          window.confirm(t('fa.dep.undoConfirm')) && voidRun.mutate(r.id)
                        }
                      >
                        <Undo2 className="size-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* register */}
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">{t('fa.registerReport.title')}</h2>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={showDisposed}
                  onChange={(e) => setShowDisposed(e.target.checked)}
                />
                {t('fa.showDisposed')}
              </label>
            </div>
            <ul className="flex flex-col gap-2">
              {(showDisposed ? rows : active).map((a) => {
                const pct = Math.min(
                  100,
                  (Number(a.accum) / Math.max(1, Number(a.cost) - Number(a.salvage))) * 100,
                )
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(a)}
                      className={cn(
                        'flex w-full cursor-pointer flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-card p-3 text-left text-sm transition-all hover:-translate-y-px hover:border-brand hover:shadow-card',
                        a.status === 'disposed' && 'opacity-60',
                      )}
                    >
                      <span className="font-mono text-xs text-muted-foreground">{a.code}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{a.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {a.category} · {formatDate(a.acquired_on, era)}
                        </span>
                      </span>
                      <span className="w-40">
                        <span className="block h-1.5 overflow-hidden rounded-full bg-muted">
                          <span
                            className="block h-full rounded-full bg-gradient-to-r from-finora-cobalt to-finora-mint"
                            style={{ width: `${pct}%` }}
                          />
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {t('fa.depreciatedPct', { pct: Math.round(pct) })}
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="block font-semibold tabular-nums">
                          {a.status === 'disposed' ? '—' : money(Number(a.cost) - Number(a.accum))}
                        </span>
                        <span className="block text-xs text-muted-foreground">{t('fa.nbv')}</span>
                      </span>
                      {a.status === 'disposed' && (
                        <Badge variant="neutral">{t('fa.registerReport.disposed')}</Badge>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>

          {canEdit && categories.data && <CategoriesPanel companyId={co.id} />}
        </>
      )}

      {categories.data && (
        <RegisterDialog
          open={registerOpen}
          onClose={() => {
            setRegisterOpen(false)
            if (params.get('register'))
              setParams(
                (p) => {
                  const n = new URLSearchParams(p)
                  n.delete('register')
                  return n
                },
                { replace: true },
              )
          }}
          companyId={co.id}
          categories={categories.data}
          pending={pending.data ?? []}
          initialLineId={params.get('register')}
          era={era}
        />
      )}
      <AssetDialog asset={selected} onClose={() => setSelected(null)} canEdit={canEdit} />
    </div>
  )
}

function CategoriesPanel({ companyId }: { companyId: string }) {
  const { t, i18n } = useTranslation()
  const { current } = useCompany()
  const categories = useCategories(companyId, true)
  const { data: accounts = [] } = useAccounts(companyId)
  const save = useSaveCategory(companyId)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [assetAcc, setAssetAcc] = useState('')
  const [accumAcc, setAccumAcc] = useState('')
  const [years, setYears] = useState('5')
  const assetAccounts = accounts.filter((a) => a.type === 'asset' && !a.is_group && a.is_active)
  const label = (id: string) => {
    const a = accounts.find((x) => x.id === id)
    return a ? `${a.code} ${i18n.language === 'en' ? a.name_en || a.name_th : a.name_th}` : ''
  }
  return (
    <details
      className="rounded-2xl border border-border/70 bg-card p-4 shadow-card"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="cursor-pointer font-semibold">{t('fa.categories.title')}</summary>
      <p className="mt-1 text-sm text-muted-foreground">{t('fa.categories.info')}</p>
      <ul className="mt-3 flex flex-col gap-1.5 text-sm">
        {(categories.data ?? []).map((c) => (
          <li key={c.id} className="flex flex-wrap gap-x-4 rounded-lg bg-muted/50 px-3 py-2">
            <span className="font-medium">{c.name}</span>
            <span className="text-muted-foreground">{label(c.asset_account_id)}</span>
            <span className="text-muted-foreground">{label(c.accum_account_id)}</span>
            <span className="ml-auto">
              {t('fa.fields.years', { n: c.default_life_months / 12 })}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,2fr)_6rem_auto] sm:items-end">
        <div className="grid gap-1">
          <label className="text-xs" htmlFor="cat-name">
            {t('fa.categories.name')}
          </label>
          <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid gap-1">
          <label className="text-xs" htmlFor="cat-asset">
            {t('fa.categories.assetAccount')}
          </label>
          <select
            id="cat-asset"
            className="h-10 rounded-xl border bg-card pr-9 pl-3 text-sm"
            value={assetAcc}
            onChange={(e) => setAssetAcc(e.target.value)}
          >
            <option value="">—</option>
            {assetAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {label(a.id)}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1">
          <label className="text-xs" htmlFor="cat-accum">
            {t('fa.categories.accumAccount')}
          </label>
          <select
            id="cat-accum"
            className="h-10 rounded-xl border bg-card pr-9 pl-3 text-sm"
            value={accumAcc}
            onChange={(e) => setAccumAcc(e.target.value)}
          >
            <option value="">—</option>
            {assetAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {label(a.id)}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1">
          <label className="text-xs" htmlFor="cat-years">
            {t('fa.fields.lifeYears')}
          </label>
          <Input
            id="cat-years"
            inputMode="decimal"
            value={years}
            onChange={(e) => setYears(e.target.value)}
          />
        </div>
        <Button
          disabled={
            !name.trim() ||
            !assetAcc ||
            !accumAcc ||
            assetAcc === accumAcc ||
            save.isPending ||
            !current
          }
          onClick={() =>
            save.mutate(
              {
                name: name.trim(),
                asset_account_id: assetAcc,
                accum_account_id: accumAcc,
                default_life_months: Math.round(Number(years) * 12),
              },
              { onSuccess: () => setName('') },
            )
          }
        >
          {t('fa.categories.add')}
        </Button>
      </div>
      {save.error != null && (
        <p className="mt-2 text-sm text-destructive">{dbErrorMessage(t, save.error)}</p>
      )}
    </details>
  )
}
