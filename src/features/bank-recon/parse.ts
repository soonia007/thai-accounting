// Bank statement import: any CSV / Excel export → rows of text → statement lines.
// Banks differ in columns, date formats (dd/mm/yyyy, BE years …) and how they sign money, so
// the user maps the columns once per bank (remembered) and we normalise here.

export interface SheetData {
  headers: string[]
  rows: string[][]
}

/** Which column holds what. Money is either one signed column, or separate out / in columns. */
export interface ColumnMapping {
  date: string
  description: string
  reference?: string
  /** one signed amount column (+ in, − out) … */
  amount?: string
  /** … or separate withdrawal / deposit columns */
  withdrawal?: string
  deposit?: string
  balance?: string
  /** dmy = 31/12/2026, mdy = 12/31/2026, ymd = 2026-12-31 */
  dateOrder: 'dmy' | 'mdy' | 'ymd'
}

export interface ParsedLine {
  txn_date: string
  description: string
  reference: string | null
  amount: number
  balance: number | null
}

export interface ParseResult {
  lines: ParsedLine[]
  /** 1-based row numbers (after the header) that could not be read */
  skipped: number[]
}

/** "1,234.50", "(1,234.50)", "-1234.5", "1.234,50"? (no — Thai banks use dot decimals), "" → null */
export function parseMoney(raw: string | undefined): number | null {
  if (raw === undefined) return null
  let s = String(raw)
    .trim()
    .replace(/\s|฿|THB|บาท/gi, '')
  if (!s || s === '-') return null
  let neg = false
  if (/^\(.*\)$/.test(s)) {
    neg = true
    s = s.slice(1, -1)
  }
  if (s.endsWith('-')) {
    neg = true
    s = s.slice(0, -1)
  }
  if (/^(dr|cr)$/i.test(s)) return null
  s = s.replace(/,/g, '')
  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return Math.round((neg ? -n : n) * 100) / 100
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Dates as text in the chosen order; 2-digit years → 20xx; Buddhist years (> 2400) → CE. */
export function parseDate(
  raw: string | undefined,
  order: ColumnMapping['dateOrder'],
): string | null {
  if (!raw) return null
  const s = String(raw).trim()
  // ISO-like timestamps from Excel
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  let y: number, m: number, d: number
  if (iso) {
    ;[y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])]
  } else {
    const parts = s
      .split(/[/.\-\s]+/)
      .filter(Boolean)
      .slice(0, 3)
      .map(Number)
    if (parts.length !== 3 || parts.some((p) => !Number.isFinite(p))) return null
    if (order === 'ymd') [y, m, d] = parts
    else if (order === 'mdy') [m, d, y] = parts
    else [d, m, y] = parts
  }
  if (y < 100) y += y > 60 ? 2500 - 543 : 2000 // "26" → 2026, "69" (BE 2569) → 2026
  if (y > 2400) y -= 543
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  const date = new Date(Date.UTC(y, m - 1, d))
  if (date.getUTCMonth() !== m - 1) return null
  return `${y}-${pad(m)}-${pad(d)}`
}

const col = (headers: string[], name: string | undefined) => (name ? headers.indexOf(name) : -1)

export function toLines(sheet: SheetData, map: ColumnMapping): ParseResult {
  const iDate = col(sheet.headers, map.date)
  const iDesc = col(sheet.headers, map.description)
  const iRef = col(sheet.headers, map.reference)
  const iAmt = col(sheet.headers, map.amount)
  const iOut = col(sheet.headers, map.withdrawal)
  const iIn = col(sheet.headers, map.deposit)
  const iBal = col(sheet.headers, map.balance)
  const lines: ParsedLine[] = []
  const skipped: number[] = []
  sheet.rows.forEach((r, i) => {
    if (r.every((c) => !String(c ?? '').trim())) return
    const date = parseDate(r[iDate], map.dateOrder)
    let amount: number | null = null
    if (iAmt >= 0) amount = parseMoney(r[iAmt])
    else {
      const out = iOut >= 0 ? parseMoney(r[iOut]) : null
      const inn = iIn >= 0 ? parseMoney(r[iIn]) : null
      if (out || inn) amount = Math.round(((inn ?? 0) - Math.abs(out ?? 0)) * 100) / 100
    }
    if (!date || !amount) {
      skipped.push(i + 1)
      return
    }
    lines.push({
      txn_date: date,
      description: iDesc >= 0 ? String(r[iDesc] ?? '').trim() : '',
      reference: iRef >= 0 ? String(r[iRef] ?? '').trim() || null : null,
      amount,
      balance: iBal >= 0 ? parseMoney(r[iBal]) : null,
    })
  })
  return { lines, skipped }
}

const has = (h: string, ...words: string[]) => words.some((w) => h.toLowerCase().includes(w))

/** First guess from typical Thai / English bank headers; the user can change every field. */
export function guessMapping(headers: string[]): ColumnMapping {
  const find = (...words: string[]) => headers.find((h) => has(h, ...words))
  const withdrawal = find('withdraw', 'debit', 'ถอน', 'เดบิต', 'จ่าย')
  const deposit = find('deposit', 'credit', 'ฝาก', 'เครดิต', 'รับ')
  return {
    date: find('date', 'วันที่') ?? headers[0] ?? '',
    description: find('desc', 'detail', 'รายละเอียด', 'รายการ', 'particular') ?? '',
    reference: find('ref', 'อ้างอิง', 'cheque', 'เช็ค'),
    amount: withdrawal || deposit ? undefined : find('amount', 'จำนวนเงิน', 'ยอดเงิน'),
    withdrawal,
    deposit,
    balance: find('balance', 'คงเหลือ', 'ยอดคงเหลือ'),
    dateOrder: 'dmy',
  }
}

/** Header row = the first row with at least 3 non-empty cells (banks often add title lines). */
export function toSheet(rows: string[][]): SheetData {
  const h = rows.findIndex((r) => r.filter((c) => String(c ?? '').trim()).length >= 3)
  if (h < 0) return { headers: [], rows: [] }
  const headers = rows[h].map((c, i) => String(c ?? '').trim() || `#${i + 1}`)
  return { headers, rows: rows.slice(h + 1).map((r) => r.map((c) => String(c ?? ''))) }
}

/** Read a CSV / Excel file in the browser (exceljs loaded on demand). */
const BOM = new RegExp('^' + String.fromCharCode(0xfeff))

export async function readStatementFile(file: File): Promise<SheetData> {
  if (/\.xlsx$/i.test(file.name)) {
    const mod = await import('exceljs')
    const ExcelJS = (mod as unknown as { default?: typeof mod }).default ?? mod
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(await file.arrayBuffer())
    const ws = wb.worksheets[0]
    const rows: string[][] = []
    ws.eachRow({ includeEmpty: false }, (row) => {
      const values = (row.values as unknown[]).slice(1)
      rows.push(
        values.map((v) => {
          if (v instanceof Date) return v.toISOString().slice(0, 10)
          if (v && typeof v === 'object' && 'result' in v)
            return String((v as { result: unknown }).result ?? '')
          if (v && typeof v === 'object' && 'text' in v)
            return String((v as { text: unknown }).text ?? '')
          return v === null || v === undefined ? '' : String(v)
        }),
      )
    })
    return toSheet(rows)
  }
  const Papa = (await import('papaparse')).default
  const text = await file.text()
  const parsed = Papa.parse<string[]>(text.replace(BOM, ''), { skipEmptyLines: 'greedy' })
  return toSheet(parsed.data)
}
