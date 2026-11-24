/** Display helpers. Money stays numeric(18,2) in the DB; these only format for people. */

export type DateEra = 'BE' | 'CE'

export function formatMoney(n: number | string | null | undefined, lang = 'th'): string {
  if (n === null || n === undefined || n === '') return '—'
  const v = typeof n === 'string' ? Number(n) : n
  return v.toLocaleString(lang === 'en' ? 'en-US' : 'th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

const TH_MONTHS = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
]
const EN_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/** Dates are stored as CE `YYYY-MM-DD`; shown as พ.ศ. or ค.ศ. per company setting (spec §2). */
export function formatDate(
  iso: string | null | undefined,
  era: DateEra = 'BE',
  style: 'short' | 'long' = 'short',
  lang = 'th',
): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  const year = era === 'BE' ? y + 543 : y
  if (style === 'long') {
    const month = (lang === 'en' ? EN_MONTHS : TH_MONTHS)[m - 1]
    return lang === 'en' ? `${d} ${month} ${year}` : `${d} ${month} ${year}`
  }
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${year}`
}

/** Today in Asia/Bangkok as YYYY-MM-DD. */
export function todayBangkok(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date())
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// Thai baht text (same convention as Excel BAHTTEXT)
// ---------------------------------------------------------------------------
const DIGITS = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า']
const PLACES = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน']

/** 0 ≤ n < 1,000,000; `leading` = there are higher non-zero digits (so a trailing 1 reads เอ็ด) */
function sixDigits(n: number, leading: boolean): string {
  const s = String(n)
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const digit = Number(s[i])
    const place = s.length - i - 1
    if (digit === 0) continue
    if (place === 1 && digit === 1) out += 'สิบ'
    else if (place === 1 && digit === 2) out += 'ยี่สิบ'
    else if (place === 0 && digit === 1 && (n > 1 || leading)) out += 'เอ็ด'
    else out += DIGITS[digit] + PLACES[place]
  }
  return out
}

function integerWords(n: number): string {
  if (n === 0) return ''
  if (n < 1_000_000) return sixDigits(n, false)
  const high = Math.floor(n / 1_000_000)
  const low = n % 1_000_000
  return integerWords(high) + 'ล้าน' + (low ? sixDigits(low, true) : '')
}

/** 1000 → "หนึ่งพันบาทถ้วน", 1.5 → "หนึ่งบาทห้าสิบสตางค์" */
export function bahtText(amount: number | string): string {
  const v = typeof amount === 'string' ? Number(amount) : amount
  if (!Number.isFinite(v)) return ''
  const cents = Math.round(Math.abs(v) * 100)
  const baht = Math.floor(cents / 100)
  const satang = cents % 100
  const sign = v < 0 && cents > 0 ? 'ลบ' : ''
  if (baht === 0 && satang === 0) return 'ศูนย์บาทถ้วน'
  const bahtPart = baht ? integerWords(baht) + 'บาท' : ''
  const satangPart = satang ? sixDigits(satang, false) + 'สตางค์' : 'ถ้วน'
  return sign + bahtPart + satangPart
}
