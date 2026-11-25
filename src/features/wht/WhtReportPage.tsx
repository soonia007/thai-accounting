import {
  ChevronLeft,
  ChevronRight,
  FileDown,
  FileInput,
  FileOutput,
  Info,
  Percent,
  Sheet,
  User,
  Users,
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
import type { ReportContent } from '@/features/reports/model'
import { ReportTableView } from '@/features/reports/ReportTableView'
import { monthLabel, previousMonth, shiftMonth } from '@/features/vat/month'
import { todayBangkok } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  buildIssuedRegister,
  buildPndAttachment,
  buildPndSummary,
  buildReceivedRegister,
} from './report-model'
import { useIssuedCerts, usePnd, useReceivedWht } from './report-queries'

type Tab = 'pnd3' | 'pnd53' | 'issued' | 'received'
const TABS: { key: Tab; icon: typeof User }[] = [
  { key: 'pnd3', icon: User },
  { key: 'pnd53', icon: Users },
  { key: 'issued', icon: FileOutput },
  { key: 'received', icon: FileInput },
]
const MONTH = /^\d{4}-\d{2}$/

const lastDay = (month: string) => {
  const d = new Date(`${shiftMonth(month, 1)}T00:00:00Z`)
  d.setUTCDate(0)
  return d.toISOString().slice(0, 10)
}

function useLabels(prefix: string, keys: readonly string[]) {
  const { t } = useTranslation()
  return useMemo(
    () => Object.fromEntries(keys.map((k) => [k, (t as (k: string) => string)(`${prefix}.${k}`)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t],
  ) as never
}

/** M11: PND.3 / PND.53 (summary + attachment) and the 50 ทวิ registers (issued / received). */
export function WhtReportPage() {
  const { t, i18n } = useTranslation()
  const { current } = useCompany()
  const co = current!
  const [params, setParams] = useSearchParams()
  const m = params.get('m')
  const month = m && MONTH.test(m) ? `${m}-01` : previousMonth(todayBangkok())
  const tab =
    (['pnd3', 'pnd53', 'issued', 'received'] as const).find((x) => x === params.get('tab')) ??
    'pnd3'
  const isRegister = tab === 'issued' || tab === 'received'
  const wholeYear = isRegister && params.get('y') === '1'
  const from = wholeYear ? `${month.slice(0, 4)}-01-01` : month
  const to = wholeYear ? `${month.slice(0, 4)}-12-31` : lastDay(month)
  const set = (patch: Record<string, string>) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        for (const [k, v] of Object.entries(patch)) n.set(k, v)
        return n
      },
      { replace: true },
    )

  const pnd = usePnd(
    co.id,
    from,
    to,
    tab === 'pnd53' ? 'pnd53' : 'pnd3',
    tab === 'pnd3' || tab === 'pnd53',
  )
  const issued = useIssuedCerts(co.id, from, to, tab === 'issued')
  const received = useReceivedWht(co.id, from, to, tab === 'received')
  const pndL = useLabels('whtReport.labels', [
    'seq',
    'taxId',
    'payee',
    'branch',
    'headOffice',
    'date',
    'incomeType',
    'rate',
    'income',
    'tax',
    'condition',
    'total',
    'payees',
    'lines',
  ])
  const regL = useLabels('whtReport.labels', [
    'seq',
    'number',
    'date',
    'payee',
    'payer',
    'taxId',
    'form',
    'pnd3',
    'pnd53',
    'income',
    'tax',
    'status',
    'voided',
    'ourDoc',
    'certNo',
    'certDate',
    'missing',
    'total',
  ])

  const q = tab === 'issued' ? issued : tab === 'received' ? received : pnd
  const content: ReportContent | undefined = useMemo(() => {
    if (tab === 'issued') return issued.data && buildIssuedRegister(issued.data, regL)
    if (tab === 'received') return received.data && buildReceivedRegister(received.data, regL)
    if (!pnd.data) return undefined
    return [
      { title: t('whtReport.summary'), table: buildPndSummary(pnd.data, i18n.language, pndL) },
      {
        title: t('whtReport.attachment'),
        table: buildPndAttachment(pnd.data, tab, i18n.language, pndL),
      },
    ]
  }, [tab, issued.data, received.data, pnd.data, regL, pndL, t, i18n.language])
  const empty =
    (tab === 'issued' && issued.data?.length === 0) ||
    (tab === 'received' && received.data?.length === 0) ||
    ((tab === 'pnd3' || tab === 'pnd53') && pnd.data?.length === 0)

  const [busy, setBusy] = useState(false)
  const [exportError, setExportError] = useState<unknown>(null)
  const periodText = wholeYear
    ? `${t('whtReport.year')} ${Number(month.slice(0, 4)) + (co.date_era === 'BE' ? 543 : 0)}`
    : `${t('whtReport.month')} ${monthLabel(month, co.date_era, i18n.language)}`
  const meta = {
    title: t(`whtReport.tabs.${tab}`),
    companies: [`${co.name}${co.tax_id ? ` · ${t('whtReport.labels.taxId')} ${co.tax_id}` : ''}`],
    period: periodText,
    fileBase: `wht-${tab}-${wholeYear ? month.slice(0, 4) : month.slice(0, 7)}`,
    lang: i18n.language,
    era: co.date_era,
  }
  const run = async (kind: 'pdf' | 'xlsx') => {
    if (!content) return
    setBusy(true)
    setExportError(null)
    try {
      if (kind === 'pdf') await exportReportPdf(content, meta, co.logo_path)
      else await exportXlsx(content, meta)
    } catch (e) {
      setExportError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <PageHeader
        icon={Percent}
        section={t('nav.reports')}
        title={t('whtReport.title')}
        description={t('whtReport.info')}
        actions={
          <ActionGroup label={t('actionGroups.export')}>
            <Button
              variant="outline"
              size="sm"
              disabled={!content || busy}
              onClick={() => run('pdf')}
            >
              <FileDown className="size-4" />
              PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!content || busy}
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
            {t('whtReport.month')}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('vat.prevMonth')}
              onClick={() => set({ m: shiftMonth(month, wholeYear ? -12 : -1).slice(0, 7) })}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Input
              type="month"
              aria-label={t('whtReport.month')}
              className="h-9 w-44"
              value={month.slice(0, 7)}
              onChange={(e) => e.target.value && set({ m: e.target.value })}
            />
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('vat.nextMonth')}
              onClick={() => set({ m: shiftMonth(month, wholeYear ? 12 : 1).slice(0, 7) })}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
        {isRegister && (
          <label className="flex h-9 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={wholeYear}
              onChange={(e) => set({ y: e.target.checked ? '1' : '0' })}
            />
            {t('whtReport.wholeYear')}
          </label>
        )}
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
              {t(`whtReport.tabs.${key}`)}
            </button>
          ))}
        </div>
      </section>

      <Alert>
        <Info className="size-4" />
        <AlertDescription>{t('whtReport.disclaimer')}</AlertDescription>
      </Alert>
      {(q.error != null || exportError != null) && (
        <Alert variant="destructive">
          <AlertDescription>{dbErrorMessage(t, q.error ?? exportError)}</AlertDescription>
        </Alert>
      )}
      <p className="text-xs text-muted-foreground">{t(`whtReport.notes.${tab}`)}</p>

      {q.isLoading && <p className="p-4 text-sm text-muted-foreground">…</p>}
      {empty ? (
        <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {t('whtReport.empty')}
        </p>
      ) : (
        content &&
        (Array.isArray(content) ? content : [{ title: undefined, table: content }]).map((s, i) => (
          <section key={i} className="flex flex-col gap-2">
            {s.title && <h2 className="text-base font-semibold">{s.title}</h2>}
            <ReportTableView table={s.table} era={co.date_era} />
          </section>
        ))
      )}
    </div>
  )
}
