import {
  Boxes,
  ClipboardList,
  FileDown,
  Package,
  PackagePlus,
  Settings2,
  Sheet,
  TriangleAlert,
  Warehouse,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { ActionGroup, PageHeader } from '@/components/PageHeader'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AccountingTabs } from '@/features/accounts/AccountingTabs'
import { dbErrorMessage } from '@/features/accounts/errors'
import { useCompany } from '@/features/company/CompanyProvider'
import { exportReportPdf } from '@/features/reports/export-pdf'
import { exportXlsx, type ReportMeta } from '@/features/reports/export-xlsx'
import type { ReportTable } from '@/features/reports/model'
import { periodRange } from '@/features/reports/period'
import { ReportTableView } from '@/features/reports/ReportTableView'
import { formatDate, todayBangkok } from '@/lib/format'
import { canEditFinanceSetup } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { AdjustmentDialog } from './AdjustmentDialog'
import { buildStockBalance, buildStockCard } from './model'
import {
  useAdjustments,
  useInventorySettings,
  useRenameWarehouse,
  useSetCostMethod,
  useStockBalance,
  useStockCard,
  useVoidAdjustment,
} from './queries'

type Tab = 'balance' | 'card' | 'adjust' | 'settings'
const TABS: { key: Tab; icon: typeof Boxes }[] = [
  { key: 'balance', icon: Boxes },
  { key: 'card', icon: ClipboardList },
  { key: 'adjust', icon: PackagePlus },
  { key: 'settings', icon: Settings2 },
]

function useLabels(prefix: string, keys: readonly string[]) {
  const { t } = useTranslation()
  return useMemo(
    () => Object.fromEntries(keys.map((k) => [k, (t as (k: string) => string)(`${prefix}.${k}`)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t],
  ) as never
}

function ExportButtons({ table, meta }: { table: ReportTable | undefined; meta: ReportMeta }) {
  const { current } = useCompany()
  const [busy, setBusy] = useState(false)
  const run = async (k: 'pdf' | 'xlsx') => {
    if (!table) return
    setBusy(true)
    try {
      if (k === 'pdf') await exportReportPdf(table, meta, current!.logo_path)
      else await exportXlsx(table, meta)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex gap-1.5">
      <Button variant="outline" size="sm" disabled={!table || busy} onClick={() => run('pdf')}>
        <FileDown className="size-4" />
        PDF
      </Button>
      <Button variant="outline" size="sm" disabled={!table || busy} onClick={() => run('xlsx')}>
        <Sheet className="size-4" />
        Excel
      </Button>
    </div>
  )
}

/** M13: stock on hand, stock card, adjustments and inventory settings. */
export function InventoryPage() {
  const { t, i18n } = useTranslation()
  const { current } = useCompany()
  const co = current!
  const canEdit = canEditFinanceSetup(co.role)
  const [params, setParams] = useSearchParams()
  const tab =
    (['balance', 'card', 'adjust', 'settings'] as const).find((x) => x === params.get('tab')) ??
    'balance'
  const set = (patch: Record<string, string>) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        for (const [k, v] of Object.entries(patch)) n.set(k, v)
        return n
      },
      { replace: true },
    )
  const [asOf, setAsOf] = useState(todayBangkok())
  const balance = useStockBalance(co.id, asOf)
  const today = useStockBalance(co.id, todayBangkok())
  const [adjOpen, setAdjOpen] = useState(false)
  const balL = useLabels('stock.balance', [
    'code',
    'name',
    'unit',
    'qty',
    'avgCost',
    'value',
    'reorder',
    'status',
    'low',
    'total',
  ])
  const rows = balance.data ?? []
  const low = (today.data ?? []).filter((r) => r.low)
  const meta = (title: string, period: string, file: string): ReportMeta => ({
    title,
    companies: [co.name],
    period,
    fileBase: file,
    lang: i18n.language,
    era: co.date_era,
  })

  return (
    <div className="flex w-full flex-col gap-4">
      <PageHeader
        icon={Boxes}
        section={t('nav.accounting')}
        title={t('stock.title')}
        description={t('stock.info')}
        actions={
          canEdit && (
            <ActionGroup label={t('actionGroups.create')}>
              <Button size="sm" disabled={rows.length === 0} onClick={() => setAdjOpen(true)}>
                <PackagePlus className="size-4" />
                {t('stock.newAdjustment')}
              </Button>
            </ActionGroup>
          )
        }
      />
      <AccountingTabs />

      {balance.data && rows.length === 0 ? (
        <section className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card p-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-accent text-brand">
            <Package className="size-6" />
          </span>
          <p className="font-medium">{t('stock.emptyTitle')}</p>
          <ol className="max-w-lg list-decimal text-left text-sm text-muted-foreground">
            <li>{t('stock.emptyStep1')}</li>
            <li>{t('stock.emptyStep2')}</li>
            <li>{t('stock.emptyStep3')}</li>
          </ol>
          <Button asChild>
            <Link to="/products">{t('stock.goProducts')}</Link>
          </Button>
        </section>
      ) : (
        <>
          {low.length > 0 && (
            <Alert>
              <TriangleAlert className="size-4" />
              <AlertDescription>
                {t('stock.lowAlert', { count: low.length })}{' '}
                {low
                  .slice(0, 5)
                  .map((r) => `${r.name} (${Number(r.qty)})`)
                  .join(', ')}
              </AlertDescription>
            </Alert>
          )}
          <div role="tablist" className="flex w-fit flex-wrap gap-1 rounded-full bg-muted p-1">
            {TABS.map(({ key, icon: Icon }) => (
              <button
                key={key}
                role="tab"
                type="button"
                aria-selected={tab === key}
                onClick={() => set({ tab: key })}
                className={cn(
                  'flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-4 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground',
                  tab === key && 'bg-card text-foreground shadow-card',
                )}
              >
                <Icon className="size-4" />
                {t(`stock.tabs.${key}`)}
              </button>
            ))}
          </div>

          {tab === 'balance' && (
            <section className="flex flex-col gap-3">
              <div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-card">
                <div className="grid gap-1">
                  <label
                    htmlFor="bal-asof"
                    className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
                  >
                    {t('reports.asOf')}
                  </label>
                  <Input
                    id="bal-asof"
                    type="date"
                    className="h-9 w-44"
                    value={asOf}
                    onChange={(e) => e.target.value && setAsOf(e.target.value)}
                  />
                </div>
                <ExportButtons
                  table={balance.data && buildStockBalance(rows, balL)}
                  meta={meta(
                    t('stock.tabs.balance'),
                    `${t('reports.asOf')} ${formatDate(asOf, co.date_era)}`,
                    `stock-balance-${asOf}`,
                  )}
                />
              </div>
              {balance.error != null && (
                <Alert variant="destructive">
                  <AlertDescription>{dbErrorMessage(t, balance.error)}</AlertDescription>
                </Alert>
              )}
              {balance.data && (
                <ReportTableView table={buildStockBalance(rows, balL)} era={co.date_era} />
              )}
            </section>
          )}

          {tab === 'card' && <CardTab products={today.data ?? []} meta={meta} />}
          {tab === 'adjust' && <AdjustmentsTab canEdit={canEdit} onNew={() => setAdjOpen(true)} />}
          {tab === 'settings' && <SettingsTab />}
        </>
      )}

      <AdjustmentDialog
        open={adjOpen}
        onClose={() => setAdjOpen(false)}
        companyId={co.id}
        stock={today.data ?? []}
      />
    </div>
  )
}

function CardTab({
  products,
  meta,
}: {
  products: { product_id: string; code: string; name: string }[]
  meta: (title: string, period: string, file: string) => ReportMeta
}) {
  const { t } = useTranslation()
  const { current } = useCompany()
  const [params, setParams] = useSearchParams()
  const productId = params.get('product') ?? products[0]?.product_id ?? null
  const yr = periodRange('thisYear', todayBangkok())
  const [from, setFrom] = useState(yr.from)
  const [to, setTo] = useState(yr.to)
  const card = useStockCard(productId, from, to)
  const L = useLabels('stock.card', [
    'date',
    'ref',
    'detail',
    'inQty',
    'outQty',
    'balQty',
    'inValue',
    'outValue',
    'balValue',
    'opening',
    'closing',
  ])
  const kinds = useLabels('stock.kinds', [
    'opening',
    'purchase',
    'sale',
    'return',
    'adjust',
    'void',
  ])
  const table = card.data && buildStockCard(card.data, { ...(L as object), kinds } as never)
  const era = current!.date_era
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-card">
        <div className="grid gap-1">
          <label
            htmlFor="card-product"
            className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
          >
            {t('stock.adjust.product')}
          </label>
          <select
            id="card-product"
            className="h-9 w-72 rounded-xl border bg-card pr-9 pl-3 text-sm"
            value={productId ?? ''}
            onChange={(e) =>
              setParams(
                (p) => {
                  const n = new URLSearchParams(p)
                  n.set('product', e.target.value)
                  return n
                },
                { replace: true },
              )
            }
          >
            {products.map((p) => (
              <option key={p.product_id} value={p.product_id}>
                {p.code} {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1">
          <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            {t('reports.period')}
          </span>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              aria-label={t('reports.from')}
              className="h-9 w-40"
              value={from}
              onChange={(e) => e.target.value && setFrom(e.target.value)}
            />
            <span>–</span>
            <Input
              type="date"
              aria-label={t('reports.to')}
              className="h-9 w-40"
              value={to}
              onChange={(e) => e.target.value && setTo(e.target.value)}
            />
          </div>
        </div>
        <div className="ml-auto">
          <ExportButtons
            table={table}
            meta={meta(
              `${t('stock.tabs.card')} — ${card.data?.product.code ?? ''} ${card.data?.product.name ?? ''}`,
              `${formatDate(from, era)} – ${formatDate(to, era)}`,
              `stock-card-${card.data?.product.code ?? ''}-${from}_${to}`,
            )}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t('stock.cardNote')}</p>
      {table && <ReportTableView table={table} era={era} />}
    </section>
  )
}

function AdjustmentsTab({ canEdit, onNew }: { canEdit: boolean; onNew: () => void }) {
  const { t } = useTranslation()
  const { current } = useCompany()
  const list = useAdjustments(current!.id)
  const voidAdj = useVoidAdjustment(current!.id)
  return (
    <section className="flex flex-col gap-3">
      {voidAdj.error != null && (
        <Alert variant="destructive">
          <AlertDescription>{dbErrorMessage(t, voidAdj.error)}</AlertDescription>
        </Alert>
      )}
      {list.data?.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          {t('stock.noAdjustments')}
          {canEdit && <Button onClick={onNew}>{t('stock.newAdjustment')}</Button>}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {(list.data ?? []).map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border bg-card p-3 text-sm"
            >
              <span className="font-mono text-xs">{a.number}</span>
              <span>{formatDate(a.adj_date, current!.date_era)}</span>
              <Badge variant="neutral">{t(`stock.adjust.kinds.${a.kind}`)}</Badge>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{a.memo}</span>
              {a.status === 'voided' ? (
                <Badge variant="danger" className="line-through">
                  {t('docStatus.voided')}
                </Badge>
              ) : (
                canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    disabled={voidAdj.isPending}
                    onClick={() => {
                      const reason = window.prompt(t('stock.voidReason'))
                      if (reason) voidAdj.mutate({ id: a.id, reason })
                    }}
                  >
                    {t('docs.void')}
                  </Button>
                )
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function SettingsTab() {
  const { t } = useTranslation()
  const { current } = useCompany()
  const co = current!
  const s = useInventorySettings(co.id)
  const setMethod = useSetCostMethod(co.id)
  const rename = useRenameWarehouse(co.id)
  const [name, setName] = useState<string | null>(null)
  const canOwner = co.role === 'owner' || co.role === 'admin'
  if (!s.data) return null
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-5 shadow-card">
        <h2 className="font-semibold">{t('stock.settings.costMethod')}</h2>
        <p className="text-sm text-muted-foreground">{t('stock.settings.costMethodInfo')}</p>
        <div role="radiogroup" className="grid gap-2">
          {(['fifo', 'average'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={s.data.costMethod === m}
              disabled={s.data.locked || !canOwner || setMethod.isPending}
              onClick={() => setMethod.mutate(m)}
              className={cn(
                'cursor-pointer rounded-xl border p-3 text-left text-sm transition-colors enabled:hover:border-brand disabled:cursor-default',
                s.data.costMethod === m && 'border-brand bg-accent',
              )}
            >
              <span className="block font-medium">{t(`stock.settings.${m}`)}</span>
              <span className="block text-xs text-muted-foreground">
                {t(`stock.settings.${m}Info`)}
              </span>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {s.data.locked ? t('stock.settings.locked') : t('stock.settings.notLocked')}
        </p>
        {setMethod.error != null && (
          <Alert variant="destructive">
            <AlertDescription>{dbErrorMessage(t, setMethod.error)}</AlertDescription>
          </Alert>
        )}
      </div>
      <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-5 shadow-card">
        <h2 className="flex items-center gap-2 font-semibold">
          <Warehouse className="size-4 text-brand" />
          {t('stock.settings.warehouse')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('stock.settings.warehouseInfo')}</p>
        {s.data.warehouse && (
          <div className="flex gap-2">
            <Input
              aria-label={t('stock.settings.warehouse')}
              value={name ?? s.data.warehouse.name}
              disabled={!canOwner}
              onChange={(e) => setName(e.target.value)}
            />
            <Button
              disabled={!name || name === s.data.warehouse.name || rename.isPending}
              onClick={() =>
                rename.mutate(
                  { id: s.data!.warehouse!.id, name: name! },
                  { onSuccess: () => setName(null) },
                )
              }
            >
              {t('common.save')}
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}
