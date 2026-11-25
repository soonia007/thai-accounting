import { describe, expect, it } from 'vitest'
import {
  buildArAp,
  buildBalanceSheet,
  buildGeneralLedger,
  buildIncomeStatement,
  buildTrialBalance,
  type AmountRow,
  type TbRow,
} from './model'

const n = (code: string, type: AmountRow['type'], th = code) => ({
  code,
  type,
  name_th: th,
  name_en: th,
})
const L = new Proxy({}, { get: (_t, k) => String(k) }) as never

describe('trial balance', () => {
  const rows: TbRow[] = [
    { ...n('1120', 'asset'), opening: 100, debit: 50, credit: 0, closing: 150 },
    { ...n('4100', 'revenue'), opening: -100, debit: 0, credit: 50, closing: -150 },
  ]
  it('splits balances into debit / credit and totals each column', () => {
    const t = buildTrialBalance(rows, 'th', L)
    expect(t.rows[0].cells).toEqual(['1120', '1120', 100, 0, 50, 0, 150, 0])
    expect(t.rows[1].cells).toEqual(['4100', '4100', 0, 100, 0, 50, 0, 150])
    expect(t.rows[2].kind).toBe('total')
    expect(t.rows[2].cells.slice(2)).toEqual([100, 100, 50, 50, 150, 150])
    expect(t.balanced).toBe(true)
  })
  it('flags an unbalanced ledger', () => {
    const t = buildTrialBalance([rows[0]], 'th', L)
    expect(t.balanced).toBe(false)
  })
})

describe('income statement', () => {
  it('shows revenue, expenses and the net result', () => {
    const t = buildIncomeStatement(
      [
        { ...n('4100', 'revenue'), amount: 1500 },
        { ...n('5100', 'expense'), amount: 200.1 },
      ],
      'th',
      L,
    )
    const last = t.rows[t.rows.length - 1]
    expect(last.kind).toBe('total')
    expect(last.cells).toEqual([null, 'netProfit', 1299.9])
  })
  it('labels a negative result as a loss', () => {
    const t = buildIncomeStatement([{ ...n('5100', 'expense'), amount: 10 }], 'th', L)
    expect(t.rows[t.rows.length - 1].cells).toEqual([null, 'netLoss', -10])
  })
})

describe('balance sheet', () => {
  it('adds the unclosed profit to equity and checks assets = liabilities + equity', () => {
    const t = buildBalanceSheet(
      {
        rows: [
          { ...n('1120', 'asset'), amount: 1405 },
          { ...n('2121', 'liability'), amount: 105 },
        ],
        unclosed_profit: 1300,
      },
      'th',
      L,
    )
    expect(t.balanced).toBe(true)
    expect(t.rows.find((r) => r.cells[1] === 'totalEquity')?.cells[2]).toBe(1300)
  })
  it('flags a sheet that does not balance', () => {
    const t = buildBalanceSheet(
      { rows: [{ ...n('1120', 'asset'), amount: 10 }], unclosed_profit: 0 },
      'th',
      L,
    )
    expect(t.balanced).toBe(false)
  })
})

describe('general ledger', () => {
  const acct = {
    ...n('2110', 'liability'),
    opening: -100,
    lines: [
      {
        date: '2026-11-01',
        company_id: 'a',
        ref: 'X1',
        description: 'pay',
        contact: null,
        debit: 30,
        credit: 0,
      },
      {
        date: '2026-11-02',
        company_id: 'a',
        ref: 'X2',
        description: null,
        contact: 'Acme',
        debit: 0,
        credit: 20,
      },
    ],
  }
  it('runs the balance in the account normal direction (credit for liabilities)', () => {
    const t = buildGeneralLedger([acct], 'th', L, { show: false, name: () => '' })
    const balances = t.rows.map((r) => r.cells[r.cells.length - 1])
    expect(balances).toEqual([null, 100, 70, 90, 90])
    expect(t.rows[3].cells[2]).toBe('Acme')
  })
  it('does not repeat the reference as the description', () => {
    const a = {
      ...acct,
      lines: [{ ...acct.lines[0], ref: 'X1', description: 'X1', contact: 'Acme' }],
    }
    const t = buildGeneralLedger([a], 'th', L, { show: false, name: () => '' })
    expect(t.rows[2].cells[2]).toBe('Acme')
  })
  it('adds a company column only for combined reports', () => {
    const t = buildGeneralLedger([acct], 'th', L, { show: true, name: (id) => `Co ${id}` })
    expect(t.columns.map((c) => c.key)).toContain('company')
    expect(t.rows[2].cells).toHaveLength(t.columns.length)
    expect(t.rows[2].cells[3]).toBe('Co a')
  })
})

describe('receivable / payable', () => {
  it('lists contacts and a grand total', () => {
    const t = buildArAp(
      [
        { company_id: 'a', contact_id: 'c', contact: 'Acme', tax_id: null, balance: 535 },
        { company_id: 'a', contact_id: null, contact: null, tax_id: null, balance: 5 },
      ],
      L,
      { show: false, name: () => '' },
    )
    expect(t.rows[1].cells[0]).toBe('unassigned')
    expect(t.rows[2].cells).toEqual(['total', null, 540])
  })
})
