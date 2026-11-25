import type { DateEra } from '@/lib/format'

const TH = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
]
const EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2026-11-01" or "2026-11" → "พ.ย. 2569" / "Nov 2026" */
export function monthLabel(month: string, era: DateEra, lang: string): string {
  const y = Number(month.slice(0, 4))
  const m = Number(month.slice(5, 7))
  return `${(lang === 'en' ? EN : TH)[m - 1]} ${era === 'BE' ? y + 543 : y}`
}

/** Effective claim month (YYYY-MM-01): the chosen one, else the tax invoice's month (D12). */
export function claimMonthOf(claimMonth: string | null, invoiceDate: string): string {
  return claimMonth ? claimMonth.slice(0, 10) : `${invoiceDate.slice(0, 7)}-01`
}

/** YYYY-MM-01 of the month before `today` — the month usually being filed. */
export function previousMonth(today: string): string {
  const y = Number(today.slice(0, 4))
  const m = Number(today.slice(5, 7))
  return m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, '0')}-01`
}

export function shiftMonth(month: string, delta: number): string {
  const y = Number(month.slice(0, 4))
  const m = Number(month.slice(5, 7)) - 1 + delta
  const yy = y + Math.floor(m / 12)
  const mm = ((m % 12) + 12) % 12
  return `${yy}-${String(mm + 1).padStart(2, '0')}-01`
}
