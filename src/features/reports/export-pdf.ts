import { createElement } from 'react'
import { companyLogoUrl } from '@/features/company/logo'
import { downloadBlob } from '@/features/pdf/render'
import type { ReportMeta } from './export-xlsx'
import type { ReportTable } from './model'

/** PDF export; react-pdf and the fonts are loaded on demand, like document PDFs. */
export async function exportReportPdf(
  table: ReportTable,
  meta: ReportMeta,
  logoPath: string | null,
): Promise<void> {
  const [{ pdf }, { ReportPdf }, { loadLogo }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('./ReportPdf'),
    import('@/features/pdf/load-logo'),
  ])
  const logo = await loadLogo(companyLogoUrl(logoPath))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blob = await pdf(createElement(ReportPdf, { table, meta, logo }) as any).toBlob()
  downloadBlob(blob, `${meta.fileBase}.pdf`)
}
