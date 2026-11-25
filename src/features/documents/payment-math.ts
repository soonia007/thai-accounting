/** Helpers for the payment form (pure, unit-tested). Amounts in baht with 2 decimals. */

const cents = (n: number) => Math.round(n * 100)
const baht = (c: number) => c / 100

export interface OpenDoc {
  id: string
  total: number
  wht_total: number
  outstanding: number
}

/**
 * Default WHT when settling `amount` of a document: the document's WHT in proportion to the
 * share of its total being settled (full settlement takes all of it).
 */
export function defaultWht(doc: OpenDoc, amount: number): number {
  if (doc.wht_total <= 0 || doc.total <= 0 || amount <= 0) return 0
  if (cents(amount) >= cents(doc.outstanding) && cents(doc.outstanding) === cents(doc.total)) {
    return doc.wht_total
  }
  return baht(Math.round((cents(doc.wht_total) * cents(amount)) / cents(doc.total)))
}

export interface AllocationInput {
  amount: number
  wht_amount: number
}

/** Money actually received/paid = settled amounts − WHT. */
export function paymentAmount(allocs: AllocationInput[]): number {
  return baht(allocs.reduce((s, a) => s + cents(a.amount) - cents(a.wht_amount), 0))
}

export function totalWht(allocs: AllocationInput[]): number {
  return baht(allocs.reduce((s, a) => s + cents(a.wht_amount), 0))
}

export type WhtCondition = 'withhold' | 'pay_always' | 'pay_once'

/** Money actually paid: with payer-borne tax (D8) the payee gets the full settled amount. */
export function paidAmount(allocs: AllocationInput[], condition: WhtCondition): number {
  return condition === 'withhold'
    ? paymentAmount(allocs)
    : baht(allocs.reduce((s, a) => s + cents(a.amount), 0))
}

export interface WhtLine {
  base_amount: number
  wht_rate: number
  wht_income_type: string | null
}

const big = (n: number, scale = 100) => BigInt(Math.round(n * scale))
/** Half-up division of non-negative BigInts (same as Postgres round() for positives). */
const divRound = (n: bigint, d: bigint) => {
  const q = n / d
  return (n % d) * 2n >= d ? q + 1n : q
}

/**
 * Tax for settling `amount` of a bill (mirror of SQL private.payment_wht_certificate + wht_tax):
 * each WHT line's base is pro-rated (amount ÷ bill total, rounded per line), grouped by
 * income type + rate, then taxed — pay_always grosses up: base × rate ÷ (100 − rate).
 */
export function settlementWht(
  lines: WhtLine[],
  docTotal: number,
  amount: number,
  condition: WhtCondition,
): number {
  if (docTotal <= 0 || amount <= 0) return 0
  const groups = new Map<string, { rateBp: bigint; base: bigint }>()
  for (const l of lines) {
    if (l.wht_rate <= 0) continue
    const base = divRound(big(l.base_amount) * big(amount), big(docTotal))
    const key = `${l.wht_income_type ?? 'other'}|${l.wht_rate}`
    const g = groups.get(key) ?? { rateBp: big(l.wht_rate), base: 0n }
    g.base += base
    groups.set(key, g)
  }
  let tax = 0n
  for (const { rateBp, base } of groups.values()) {
    if (base <= 0n) continue
    tax +=
      condition === 'pay_always'
        ? divRound(base * rateBp, 10000n - rateBp)
        : divRound(base * rateBp, 10000n)
  }
  return Number(tax) / 100
}
