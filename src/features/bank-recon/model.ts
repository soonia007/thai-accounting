import type { ReportRow, ReportTable } from '@/features/reports/model'
import type { Reconciliation } from './queries'

export interface RecLabels {
  date: string
  ref: string
  description: string
  amount: string
  statementBalance: string
  bookOnly: string
  statementOnly: string
  adjusted: string
  bookBalance: string
  difference: string
  none: string
}

const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * Statement balance
 *   + items in the books not yet on the statement (deposits in transit +, unpresented payments −)
 *   − items on the statement not yet in the books (charges −, interest +)
 *   = adjusted balance, which must equal the book balance.
 */
export function buildReconciliation(r: Reconciliation, L: RecLabels): ReportTable {
  const stmt = r.statement_balance === null ? null : Number(r.statement_balance)
  const bookOnly = r.book_not_on_statement.map<ReportRow>((x) => ({
    indent: true,
    cells: [
      x.date,
      x.ref,
      [x.description, x.contact].filter(Boolean).join(' · ') || null,
      r2(Number(x.amount)),
    ],
  }))
  const stmtOnly = r.statement_not_in_book.map<ReportRow>((x) => ({
    indent: true,
    cells: [x.date, x.ref, x.description, r2(-Number(x.amount))],
  }))
  const adjusted =
    stmt === null
      ? null
      : r2(stmt + Number(r.book_not_on_statement_total) - Number(r.statement_not_in_book_total))
  const none: ReportRow = { indent: true, cells: [null, null, L.none, null] }
  return {
    columns: [
      { key: 'date', label: L.date, weight: 1.5 },
      { key: 'ref', label: L.ref, weight: 1.8 },
      { key: 'desc', label: L.description, weight: 4.5 },
      { key: 'amount', label: L.amount, align: 'right', weight: 2, money: true },
    ],
    balanced: r.difference === null ? undefined : Number(r.difference) === 0,
    rows: [
      { kind: 'subtotal', cells: [null, null, L.statementBalance, stmt] },
      { kind: 'section', cells: [null, L.bookOnly, null, null] },
      ...(bookOnly.length ? bookOnly : [none]),
      { kind: 'section', cells: [null, L.statementOnly, null, null] },
      ...(stmtOnly.length ? stmtOnly : [none]),
      { kind: 'subtotal', cells: [null, null, L.adjusted, adjusted] },
      { kind: 'subtotal', cells: [null, null, L.bookBalance, r2(Number(r.book_balance))] },
      {
        kind: 'total',
        cells: [null, null, L.difference, r.difference === null ? null : r2(Number(r.difference))],
      },
    ],
  }
}
