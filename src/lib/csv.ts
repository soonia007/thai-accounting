import Papa from 'papaparse'

/** UTF-8 BOM so Excel opens Thai text correctly. */
const BOM = String.fromCharCode(0xfeff)

export type CsvRow = Record<string, string>

export function toCsv(columns: readonly string[], rows: Record<string, unknown>[]): string {
  const data = rows.map((r) =>
    columns.map((c) => {
      const v = r[c]
      if (v === null || v === undefined) return ''
      return String(v)
    }),
  )
  return BOM + Papa.unparse({ fields: [...columns], data }, { newline: '\r\n' })
}

export function parseCsv(text: string): { headers: string[]; rows: CsvRow[] } {
  const result = Papa.parse<CsvRow>(text.startsWith(BOM) ? text.slice(1) : text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim().toLowerCase(),
    transform: (v) => v.trim(),
  })
  return { headers: result.meta.fields ?? [], rows: result.data }
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export interface RowError {
  /** 1-based data row number as shown in a spreadsheet (header = row 1, so data starts at 2). */
  row: number
  field: string
  /** i18n key under `import.errors.*` */
  code: string
}

export interface ImportPlan<T> {
  valid: T[]
  errors: RowError[]
  missingColumns: string[]
}

/** Accept common yes/no spellings (English + Thai). Empty → fallback. */
export function parseBool(v: string | undefined, fallback: boolean): boolean | null {
  if (v === undefined || v === '') return fallback
  const s = v.toLowerCase()
  if (['true', '1', 'yes', 'y', 'ใช่', 'ใช้งาน'].includes(s)) return true
  if (['false', '0', 'no', 'n', 'ไม่', 'ไม่ใช้งาน', 'ปิด'].includes(s)) return false
  return null
}

/** Money: "1,234.50" → 1234.5; empty → null; invalid → NaN. */
export function parseMoney(v: string | undefined): number | null {
  if (v === undefined || v === '') return null
  const n = Number(v.replace(/,/g, ''))
  if (!Number.isFinite(n)) return NaN
  return Math.round(n * 100) / 100
}
