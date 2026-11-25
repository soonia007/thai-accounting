import { CheckCircle2, FileDown, Sheet, TriangleAlert, type LucideIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ActionGroup, PageHeader } from '@/components/PageHeader'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { dbErrorMessage } from '@/features/accounts/errors'
import { useCompany } from '@/features/company/CompanyProvider'
import { formatDate } from '@/lib/format'
import { exportReportPdf } from './export-pdf'
import { exportXlsx, type ReportMeta } from './export-xlsx'
import type { ReportTable } from './model'
import { ReportFilters } from './ReportFilters'
import { ReportTableView } from './ReportTableView'
import type { ReportScope } from './scope'

/**
 * Shared frame of every report: header (section · title · what it is), filters, export buttons
 * (PDF / Excel), balance check, table. The report itself only supplies a ReportTable.
 */
export function ReportPage({
  icon,
  name,
  scope,
  mode,
  table,
  isLoading,
  error,
  filters,
  note,
}: {
  icon: LucideIcon
  /** key under `reports.pages.*` (title, info) and the export file name */
  name: string
  scope: ReportScope
  mode: 'period' | 'asOf'
  table: ReportTable | undefined
  isLoading: boolean
  error: unknown
  filters?: ReactNode
  note?: string
}) {
  const { t, i18n } = useTranslation()
  const { companies, current } = useCompany()
  const [busy, setBusy] = useState<'pdf' | 'xlsx' | null>(null)
  const [exportError, setExportError] = useState<unknown>(null)
  const era = current?.date_era ?? 'BE'
  const selected = companies.filter((c) => scope.companyIds.includes(c.id))
  const title = t(`reports.pages.${name}.title`)

  const period =
    mode === 'period'
      ? `${formatDate(scope.from, era)} – ${formatDate(scope.to, era)}`
      : `${t('reports.asOf')} ${formatDate(scope.to, era)}`
  const meta: ReportMeta = {
    title,
    companies: selected.map((c) => c.name),
    period,
    fileBase: `${name}-${mode === 'period' ? `${scope.from}_${scope.to}` : scope.to}`,
    lang: i18n.language,
    era,
  }

  const run = async (kind: 'pdf' | 'xlsx') => {
    if (!table) return
    setBusy(kind)
    setExportError(null)
    try {
      if (kind === 'pdf') {
        await exportReportPdf(table, meta, selected[0]?.logo_path ?? null)
      } else {
        await exportXlsx(table, meta)
      }
    } catch (e) {
      setExportError(e)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <PageHeader
        icon={icon}
        section={t('nav.reports')}
        title={title}
        description={t(`reports.pages.${name}.info`)}
        actions={
          <ActionGroup label={t('actionGroups.export')}>
            <Button
              variant="outline"
              size="sm"
              disabled={!table || busy !== null}
              onClick={() => run('pdf')}
            >
              <FileDown className="size-4" />
              PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!table || busy !== null}
              onClick={() => run('xlsx')}
            >
              <Sheet className="size-4" />
              Excel
            </Button>
          </ActionGroup>
        }
      />
      <ReportFilters scope={scope} mode={mode}>
        {filters}
      </ReportFilters>

      {(error != null || exportError != null) && (
        <Alert variant="destructive">
          <AlertDescription>{dbErrorMessage(t, error ?? exportError)}</AlertDescription>
        </Alert>
      )}
      {scope.companyIds.length > 1 && (
        <p className="text-xs text-muted-foreground">{t('reports.combinedNote')}</p>
      )}
      {note && <p className="text-xs text-muted-foreground">{note}</p>}

      {isLoading && <p className="p-4 text-sm text-muted-foreground">…</p>}
      {table && table.rows.length === 0 && (
        <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {t('reports.empty')}
        </p>
      )}
      {table && table.rows.length > 0 && (
        <>
          {table.balanced !== undefined && (
            <p
              className={
                table.balanced
                  ? 'flex items-center gap-1.5 text-sm text-success-foreground'
                  : 'flex items-center gap-1.5 text-sm text-destructive'
              }
              role="status"
            >
              {table.balanced ? (
                <CheckCircle2 className="size-4" />
              ) : (
                <TriangleAlert className="size-4" />
              )}
              {t(table.balanced ? 'reports.balanced' : 'reports.unbalanced')}
            </p>
          )}
          <ReportTableView table={table} era={era} />
        </>
      )}
    </div>
  )
}
