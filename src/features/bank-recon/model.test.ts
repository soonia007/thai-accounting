import { describe, expect, it } from 'vitest'
import { buildReconciliation } from './model'

const L = new Proxy({}, { get: (_t, k) => String(k) }) as never

describe('reconciliation report', () => {
  // the figures of supabase/tests/13_m12_bank_reconciliation.test.sql before adjustments
  const r = {
    as_of: '2026-11-30',
    book_balance: 3000,
    statement_balance: 3762,
    book_not_on_statement: [
      { date: '2026-11-28', ref: 'CP-1', description: null, contact: 'V', amount: -800 },
    ],
    book_not_on_statement_total: -800,
    statement_not_in_book: [
      { date: '2026-11-30', ref: null, description: 'FEE', amount: -50 },
      { date: '2026-11-30', ref: null, description: 'INTEREST', amount: 12 },
    ],
    statement_not_in_book_total: -38,
    difference: 0,
  }
  it('statement − / + outstanding items = book balance', () => {
    const t = buildReconciliation(r, L)
    expect(t.balanced).toBe(true)
    const byLabel = (l: string) => t.rows.find((x) => x.cells[2] === l)?.cells[3]
    expect(byLabel('statementBalance')).toBe(3762)
    expect(byLabel('adjusted')).toBe(3000)
    expect(byLabel('bookBalance')).toBe(3000)
    // statement-only items are shown with the sign they have on the adjustment (fee +50, interest −12)
    expect(t.rows.filter((x) => x.cells[2] === 'FEE')[0].cells[3]).toBe(50)
  })
  it('without a statement balance it cannot say whether it reconciles', () => {
    const t = buildReconciliation({ ...r, statement_balance: null, difference: null }, L)
    expect(t.balanced).toBeUndefined()
  })
})
