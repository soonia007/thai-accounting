import { describe, expect, it } from 'vitest'
import { buildPp30, buildVatRegister, filingOutdated, type VatRow, type VatSummary } from './model'

const L = new Proxy({}, { get: (_t, k) => String(k) }) as never
const row = (over: Partial<VatRow>): VatRow => ({
  date: '2026-10-05',
  number: 'INV-1',
  contact: 'Acme',
  tax_id: '1101700230708',
  branch: '00000',
  base: 10000,
  vat: 700,
  kind: 'document',
  source_id: 'x',
  ...over,
})

describe('VAT register', () => {
  it('numbers rows, names the head office and totals base / VAT', () => {
    const t = buildVatRegister(
      [row({}), row({ branch: '00002', base: 5000, vat: 350 })],
      'sales',
      L,
    )
    expect(t.rows[0].cells).toEqual([
      '1',
      '2026-10-05',
      'INV-1',
      'Acme',
      '1101700230708',
      'headOffice',
      10000,
      700,
    ])
    expect(t.rows[1].cells[5]).toBe('branchNo 00002')
    expect(t.rows[2].cells).toHaveLength(t.columns.length)
    expect(t.rows[2].cells.slice(-2)).toEqual([15000, 1050])
  })
  it('purchases show our document and flag late claims', () => {
    const t = buildVatRegister([row({ our_number: 'PV-1', late: true })], 'purchases', L)
    expect(t.columns.map((c) => c.key)).toContain('ours')
    expect(t.rows[0].cells[6]).toBe('PV-1 · late')
    expect(t.rows[1].cells).toHaveLength(t.columns.length)
  })
})

const summary = (over: Partial<VatSummary> = {}): VatSummary => ({
  month: '2026-10-01',
  sales_total: 18000,
  zero_rated: 2000,
  exempt: 1000,
  taxable_sales: 15000,
  output_vat: 1050,
  purchase_base: 7000,
  input_vat: 490,
  carried_in: 0,
  net: 560,
  previous_filed: false,
  has_earlier_filing: false,
  filing: null,
  ...over,
})

describe('PP.30', () => {
  it('fills lines 8 / 11 when tax is payable', () => {
    const cells = buildPp30(summary(), L).rows.map((r) => r.cells[2])
    expect(cells).toEqual([18000, 2000, 1000, 15000, 1050, 7000, 490, 560, 0, 0, 560, 0])
  })
  it('fills lines 9 / 12 when overpaid, after the carried-in credit', () => {
    const s = summary({ output_vat: 0, input_vat: 210, carried_in: 100, net: -310 })
    const cells = buildPp30(s, L).rows.map((r) => r.cells[2])
    expect(cells.slice(7)).toEqual([0, 210, 100, 0, 310])
  })
  it('detects a filing that no longer matches the books', () => {
    const f = {
      filed_at: '',
      excess_choice: null,
      net: 560,
      output_vat: 1050,
      input_vat: 490,
      carried_in: 0,
    }
    expect(filingOutdated(summary({ filing: f }))).toBe(false)
    expect(filingOutdated(summary({ filing: f, input_vat: 500 }))).toBe(true)
  })
})
