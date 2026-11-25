import { downloadBlob } from '@/features/pdf/render'
import { formatDate, type DateEra } from '@/lib/format'
import type { ReportTable } from './model'

export interface ReportMeta {
  title: string
  /** company names (one, or several for a combined report) */
  companies: string[]
  /** human-readable period, e.g. "01/01/2569 – 25/11/2569" */
  period: string
  /** file name without extension */
  fileBase: string
  lang: string
  /** how dates (YYYY-MM-DD cells) are shown */
  era?: DateEra
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
/** Date cells are stored ISO; exports show them like the screen does. */
export const showDate = (v: string | number | null, era: DateEra = 'BE') =>
  typeof v === 'string' && ISO_DATE.test(v) ? formatDate(v, era) : v

const COBALT = 'FF0443A8'
const ACCENT = 'FFE8F2FD'
const TINT = 'FFF4F7FC'
const MONEY = '#,##0.00;-#,##0.00'

/** Excel export (exceljs is loaded on demand — it is large and only needed here). */
export async function exportXlsx(table: ReportTable, meta: ReportMeta): Promise<void> {
  const mod = await import('exceljs')
  const ExcelJS = (mod as unknown as { default?: typeof mod }).default ?? mod
  const wb = new ExcelJS.Workbook()
  wb.creator = 'FINORA'
  const ws = wb.addWorksheet(meta.title.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31))
  const n = table.columns.length

  const head = (text: string, size: number, bold: boolean, color?: string) => {
    const row = ws.addRow([text])
    row.getCell(1).font = {
      name: 'Sarabun',
      size,
      bold,
      color: color ? { argb: color } : undefined,
    }
  }
  head(meta.companies.join(', '), 14, true)
  head(meta.title, 12, true, COBALT)
  head(meta.period, 10, false, 'FF5B6B82')
  ws.addRow([])

  const header = ws.addRow(table.columns.map((c) => c.label))
  header.eachCell((cell, i) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COBALT } }
    cell.alignment = {
      horizontal: table.columns[i - 1].align === 'right' ? 'right' : 'left',
      vertical: 'middle',
      wrapText: true,
    }
  })
  ws.views = [{ state: 'frozen', ySplit: header.number }]

  for (const r of table.rows) {
    const row = ws.addRow(r.cells.map((c) => showDate(c, meta.era) ?? null))
    row.eachCell({ includeEmpty: true }, (cell, i) => {
      const col = table.columns[i - 1]
      if (!col) return
      if (typeof cell.value === 'number' && col.money) cell.numFmt = MONEY
      cell.alignment = {
        horizontal: col.align === 'right' ? 'right' : 'left',
        indent: r.indent && i === table.columns.findIndex((c) => !c.money) + 1 ? 1 : 0,
      }
      if (r.kind === 'section') {
        cell.font = { bold: true, color: { argb: COBALT } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ACCENT } }
      } else if (r.kind === 'subtotal') {
        cell.font = { bold: true }
        cell.border = { top: { style: 'thin', color: { argb: 'FF8FA3BF' } } }
      } else if (r.kind === 'total') {
        cell.font = { bold: true }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TINT } }
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF8FA3BF' } },
          bottom: { style: 'double', color: { argb: 'FF8FA3BF' } },
        }
      }
    })
  }

  table.columns.forEach((c, i) => {
    ws.getColumn(i + 1).width = Math.max(10, Math.round((c.weight ?? 1) * 9))
  })
  ws.getColumn(1).width = Math.max(ws.getColumn(1).width ?? 10, Math.min(18, n * 3))

  const buf = await wb.xlsx.writeBuffer()
  downloadBlob(
    new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `${meta.fileBase}.xlsx`,
  )
}
