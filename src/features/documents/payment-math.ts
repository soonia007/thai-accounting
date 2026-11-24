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
