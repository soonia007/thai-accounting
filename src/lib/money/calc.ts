/**
 * Client-side mirror of SQL `public.calc_line` (supabase/migrations/*_m4_posting_engine.sql).
 *
 * Used only for instant form totals. The journal preview always comes from the DB
 * (`simulate_posting`) so there is one source of truth for posting rules.
 * Exact decimal math with BigInt — no floating-point drift. Tests in calc.test.ts use the
 * same numbers as supabase/tests/04_m4_posting_engine.test.sql.
 */

export type VatMode = 'exclusive' | 'inclusive' | 'none'
export type ItemKind = 'product' | 'service'

export interface LineInput {
  qty: number | string
  unitPrice: number | string
  discount?: number | string
  /** Effective VAT rate for this line in percent (0 when no VAT / zero-rated / exempt). */
  vatRate: number | string
  whtRate?: number | string
  itemKind?: ItemKind
}

export interface LineAmounts {
  base: number
  vat: number
  wht: number
}

/** Parse a decimal into an integer scaled by 10^scale (rounding extra digits half-up). */
function toScaled(value: number | string | undefined, scale: number): bigint {
  if (value === undefined || value === null || value === '') return 0n
  let s = typeof value === 'number' ? value.toFixed(Math.max(scale, 10)) : value.trim()
  s = s.replace(/,/g, '')
  if (!/^-?\d*(\.\d*)?$/.test(s)) throw new Error(`Invalid number: ${value}`)
  const neg = s.startsWith('-')
  if (neg) s = s.slice(1)
  const [int = '0', frac = ''] = s.split('.')
  const padded = (frac + '0'.repeat(scale + 1)).slice(0, scale + 1)
  let n = BigInt((int || '0') + padded.slice(0, scale))
  if (Number(padded[scale]) >= 5) n += 1n
  return neg ? -n : n
}

/** a / b rounded half away from zero (matches Postgres round() on numeric). */
function divRound(a: bigint, b: bigint): bigint {
  const neg = a < 0n !== b < 0n
  const aa = a < 0n ? -a : a
  const bb = b < 0n ? -b : b
  const q = (aa * 2n + bb) / (bb * 2n)
  return neg ? -q : q
}

const toNumber = (cents: bigint) => Number(cents) / 100

export class NegativeLineError extends Error {
  constructor() {
    super('LINE_NEGATIVE')
  }
}

export function calcLine(line: LineInput, vatMode: VatMode): LineAmounts {
  // qty (4dp) × price (4dp) → 8dp, rounded to cents
  const gross =
    divRound(toScaled(line.qty, 4) * toScaled(line.unitPrice, 4), 1_000_000n) -
    toScaled(line.discount, 2)
  if (gross < 0n) throw new NegativeLineError()

  const rate = toScaled(line.vatRate, 2) // percent × 100
  let base: bigint
  let vat: bigint
  if (vatMode === 'none' || rate === 0n) {
    base = gross
    vat = 0n
  } else if (vatMode === 'inclusive') {
    vat = divRound(gross * rate, 10_000n + rate)
    base = gross - vat
  } else {
    base = gross
    vat = divRound(gross * rate, 10_000n)
  }
  const wht = divRound(base * toScaled(line.whtRate, 2), 10_000n)
  return { base: toNumber(base), vat: toNumber(vat), wht: toNumber(wht) }
}

export interface DocumentTotals {
  subtotal: number
  vatTotal: number
  /** VAT on service lines (deferred on credit invoices/bills — docs/DECISIONS.md D1/D2) */
  vatService: number
  total: number
  whtTotal: number
  netTotal: number
  lines: LineAmounts[]
}

export function calcDocument(lines: LineInput[], vatMode: VatMode): DocumentTotals {
  let subtotal = 0n
  let vat = 0n
  let vatService = 0n
  let wht = 0n
  const out: LineAmounts[] = []
  for (const l of lines) {
    const a = calcLine(l, vatMode)
    out.push(a)
    const c = (n: number) => BigInt(Math.round(n * 100))
    subtotal += c(a.base)
    vat += c(a.vat)
    wht += c(a.wht)
    if ((l.itemKind ?? 'service') === 'service') vatService += c(a.vat)
  }
  const total = subtotal + vat
  return {
    subtotal: toNumber(subtotal),
    vatTotal: toNumber(vat),
    vatService: toNumber(vatService),
    total: toNumber(total),
    whtTotal: toNumber(wht),
    netTotal: toNumber(total - wht),
    lines: out,
  }
}
