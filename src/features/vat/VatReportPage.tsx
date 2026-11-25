import {
  ChevronLeft,
  ChevronRight,
  FileDown,
  Info,
  Landmark,
  Receipt,
  Send,
  Sheet,
  ShoppingCart,
  TriangleAlert,
  Undo2,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { ActionGroup, PageHeader } from '@/components/PageHeader'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { dbErrorMessage } from '@/features/accounts/errors'
import { useCompany } from '@/features/company/CompanyProvider'
import { exportReportPdf } from '@/features/reports/export-pdf'
import { exportXlsx } from '@/features/reports/export-xlsx'
import { ReportTableView } from '@/features/reports/ReportTableView'
import { formatDate, formatMoney, todayBangkok } from '@/lib/format'
import { canEditFinanceSetup } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { buildPp30, buildVatRegister, filingOutdated, type VatSummary } from './model'
import { monthLabel, previousMonth, shiftMonth } from './month'
import {
  useFileVatReturn,
  useUnfileVatReturn,
  useVatPurchases,
  useVatSales,
  useVatSummary,
} from './queries'

type Tab = 'sales' | 'purchases' | 'pp30'
const TABS: { key: Tab; icon: typeof Receipt }[] = [
  { key: 'sales', icon: Receipt },
  { key: 'purchases', icon: ShoppingCart },
  { key: 'pp30', icon: Landmark },
]
const MONTH = /^\d{4}-\d{2}$/

function useLabels(prefix: string, keys: readonly string[]) {
  const { t } = useTranslation()
  return useMemo(
    () => Object.fromEntries(keys.map((k) => [k, (t as (k: string) => string)(`${prefix}.${k}`)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t],
  ) as never
}

/** M10: output / input VAT registers and the PP.30 summary for one company and one month. */
export function VatReportPage() {
  const { t, i18n } = useTranslation()
  const { current } = useCompany()
  const co = current!
  const [params, setParams] = useSearchParams()
  const m = params.get('m')
  const month = m && MONTH.test(m) ? `${m}-01` : previousMonth(todayBangkok())
  const tab =
    (['sales', 'purchases', 'pp30'] as const).find((x) => x === params.get('tab')) ?? 'sales'
  const set = (patch: Record<string, string>) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        for (const [k, v] of Object.entries(patch)) n.set(k, v)
        return n
      },
      { replace: true },
    )

  const sales = useVatSales(co.id, month)
  const purchases = useVatPurchases(co.id, month)
  const summary = useVatSummary(co.id, month)
  const regL = useLabels('vat.labels', [
    'seq',
    'date',
    'invoiceNo',
    'buyer',
    'seller',
    'taxId',
    'branch',
    'headOffice',
    'branchNo',
    'base',
    'vat',
    'ourDoc',
    'late',
    'total',
  ])
  const ppL = useLabels('vat.pp30', [
    'item',
    'amount',
    'l1',
    'l2',
    'l3',
    'l4',
    'l5',
    'l6',
    'l7',
    'l8',
    'l9',
    'l10',
    'l11',
    'l12',
  ])

  const q = tab === 'sales' ? sales : tab === 'purchases' ? purchases : summary
  const table = useMemo(() => {
    if (tab === 'sales') return sales.data && buildVatRegister(sales.data, 'sales', regL)
    if (tab === 'purchases')
      return purchases.data && buildVatRegister(purchases.data, 'purchases', regL)
    return summary.data && buildPp30(summary.data, ppL)
  }, [tab, sales.data, purchases.data, summary.data, regL, ppL])

  const [busy, setBusy] = useState(false)
  const [exportError, setExportError] = useState<unknown>(null)
  const title = t(`vat.tabs.${tab}`)
  const meta = {
    title,
    companies: [`${co.name}${co.tax_id ? ` · ${t('vat.labels.taxId')} ${co.tax_id}` : ''}`],
    period: `${t('vat.taxMonth')} ${monthLabel(month, co.date_era, i18n.language)}`,
    fileBase: `vat-${tab}-${month.slice(0, 7)}`,
    lang: i18n.language,
    era: co.date_era,
  }
  const run = async (kind: 'pdf' | 'xlsx') => {
    if (!table) return
    setBusy(true)
    setExportError(null)
    try {
      if (kind === 'pdf') await exportReportPdf(table, meta, co.logo_path)
      else await exportXlsx(table, meta)
    } catch (e) {
      setExportError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <PageHeader
        icon={Landmark}
        section={t('nav.reports')}
        title={t('vat.title')}
        description={t('vat.info')}
        actions={
          <ActionGroup label={t('actionGroups.export')}>
            <Button
              variant="outline"
              size="sm"
              disabled={!table || busy}
              onClick={() => run('pdf')}
            >
              <FileDown className="size-4" />
              PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!table || busy}
              onClick={() => run('xlsx')}
            >
              <Sheet className="size-4" />
              Excel
            </Button>
          </ActionGroup>
        }
      />

      <section className="flex flex-wrap items-end gap-x-5 gap-y-3 rounded-2xl border border-border/70 bg-card p-4 shadow-card">
        <div className="flex flex-col gap-1">
          <span className="px-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            {t('vat.taxMonth')}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('vat.prevMonth')}
              onClick={() => set({ m: shiftMonth(month, -1).slice(0, 7) })}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Input
              type="month"
              aria-label={t('vat.taxMonth')}
              className="h-9 w-44"
              value={month.slice(0, 7)}
              onChange={(e) => e.target.value && set({ m: e.target.value })}
            />
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('vat.nextMonth')}
              onClick={() => set({ m: shiftMonth(month, 1).slice(0, 7) })}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
        <div role="tablist" className="flex flex-wrap gap-1 rounded-full bg-muted p-1">
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
              {t(`vat.tabs.${key}`)}
            </button>
          ))}
        </div>
      </section>

      <Alert>
        <Info className="size-4" />
        <AlertDescription>{t('vat.disclaimer')}</AlertDescription>
      </Alert>
      {!co.vat_registered && (
        <Alert>
          <AlertDescription>{t('vat.notRegistered')}</AlertDescription>
        </Alert>
      )}
      {(q.error != null || exportError != null) && (
        <Alert variant="destructive">
          <AlertDescription>{dbErrorMessage(t, q.error ?? exportError)}</AlertDescription>
        </Alert>
      )}
      {tab === 'purchases' && (
        <p className="text-xs text-muted-foreground">{t('vat.purchasesNote')}</p>
      )}
      {tab === 'sales' && <p className="text-xs text-muted-foreground">{t('vat.salesNote')}</p>}

      {q.isLoading && <p className="p-4 text-sm text-muted-foreground">…</p>}
      {table && tab !== 'pp30' && table.rows.length === 1 ? (
        <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {t('vat.empty')}
        </p>
      ) : (
        table && <ReportTableView table={table} era={co.date_era} />
      )}

      {tab === 'pp30' && summary.data && co.vat_registered && (
        <FilingPanel summary={summary.data} month={month} />
      )}
    </div>
  )
}

function FilingPanel({ summary, month }: { summary: VatSummary; month: string }) {
  const { t, i18n } = useTranslation()
  const { current } = useCompany()
  const co = current!
  const file = useFileVatReturn(co.id)
  const unfile = useUnfileVatReturn(co.id)
  const [choice, setChoice] = useState<'refund' | 'carry'>('carry')
  const [opening, setOpening] = useState('')
  const canFile = canEditFinanceSetup(co.role)
  const canUnfile = co.role === 'owner' || co.role === 'admin'
  const firstFiling = !summary.has_earlier_filing
  const openingNum = Number(opening.replace(/,/g, '')) || 0
  const net =
    Number(summary.output_vat) -
    Number(summary.input_vat) -
    (firstFiling ? openingNum : Number(summary.carried_in))
  const money = (v: number) => formatMoney(v, i18n.language)

  if (summary.filing) {
    return (
      <section className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-card">
        <p className="flex items-center gap-2 text-sm font-medium text-success-foreground">
          <Send className="size-4" />
          {t('vat.filed', {
            date: formatDate(summary.filing.filed_at.slice(0, 10), co.date_era),
            result:
              Number(summary.filing.net) >= 0
                ? t('vat.resultPay', { amount: money(Number(summary.filing.net)) })
                : t(`vat.resultExcess.${summary.filing.excess_choice}`, {
                    amount: money(-Number(summary.filing.net)),
                  }),
          })}
        </p>
        {filingOutdated(summary) && (
          <p className="flex items-center gap-2 text-sm text-destructive">
            <TriangleAlert className="size-4" />
            {t('vat.outdated')}
          </p>
        )}
        {unfile.error != null && (
          <Alert variant="destructive">
            <AlertDescription>{dbErrorMessage(t, unfile.error)}</AlertDescription>
          </Alert>
        )}
        {canUnfile && (
          <div>
            <Button
              variant="ghost"
              size="sm"
              disabled={unfile.isPending}
              onClick={() => unfile.mutate(month)}
            >
              <Undo2 className="size-4" />
              {t('vat.unfile')}
            </Button>
          </div>
        )}
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-card">
      <h2 className="text-base font-semibold">{t('vat.fileTitle')}</h2>
      <p className="text-sm text-muted-foreground">{t('vat.fileInfo')}</p>
      {firstFiling && (
        <div className="grid max-w-sm gap-2">
          <label htmlFor="vat-opening" className="text-sm font-medium">
            {t('vat.openingCarry')}
          </label>
          <Input
            id="vat-opening"
            inputMode="decimal"
            placeholder="0.00"
            className="text-right"
            value={opening}
            onChange={(e) => setOpening(e.target.value)}
          />
        </div>
      )}
      {summary.has_earlier_filing && !summary.previous_filed && (
        <p className="text-sm text-destructive">{t('dbErrors.VAT_PREVIOUS_MONTH_NOT_FILED')}</p>
      )}
      <p className="text-sm">
        {net >= 0
          ? t('vat.resultPay', { amount: money(net) })
          : t('vat.resultExcessPending', { amount: money(-net) })}
      </p>
      {net < 0 && (
        <div role="radiogroup" className="flex flex-wrap gap-4 text-sm">
          {(['carry', 'refund'] as const).map((c) => (
            <label key={c} className="flex items-center gap-2">
              <input
                type="radio"
                name="vat-excess"
                checked={choice === c}
                onChange={() => setChoice(c)}
              />
              {t(`vat.choice.${c}`)}
            </label>
          ))}
        </div>
      )}
      {file.error != null && (
        <Alert variant="destructive">
          <AlertDescription>{dbErrorMessage(t, file.error)}</AlertDescription>
        </Alert>
      )}
      {canFile && (
        <div>
          <Button
            disabled={file.isPending}
            onClick={() =>
              file.mutate({
                month,
                choice: net < 0 ? choice : null,
                carriedIn: firstFiling && openingNum > 0 ? openingNum : null,
              })
            }
          >
            <Send className="size-4" />
            {t('vat.markFiled')}
          </Button>
        </div>
      )}
    </section>
  )
}
