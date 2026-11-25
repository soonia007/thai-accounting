import { describe, expect, it } from 'vitest'
import {
  buildIssuedRegister,
  buildPndAttachment,
  buildPndSummary,
  buildReceivedRegister,
  conditionCode,
  type PndLine,
} from './report-model'

const L = new Proxy({}, { get: (_t, k) => String(k) }) as never
const line = (over: Partial<PndLine>): PndLine => ({
  cert_id: 'c',
  cert_number: 'WHT-1',
  date: '2026-11-05',
  contact: 'Vendor Co',
  tax_id: '0105536000313',
  branch: '00000',
  address: null,
  income_type: 'rent',
  income_name_th: 'ค่าเช่า',
  income_name_en: 'Rent',
  section: '40(5)',
  rate: 5,
  income: 20000,
  tax: 1000,
  condition: 'withhold',
  ...over,
})
// the PND.53 figures of supabase/tests/12_m11_wht.test.sql
const pnd53 = [
  line({}),
  line({
    income_type: 'transport',
    income_name_th: 'ค่าขนส่ง',
    section: '40(8)',
    rate: 1,
    income: 5000,
    tax: 50,
  }),
  line({
    income_type: 'service',
    income_name_th: 'ค่าบริการ',
    section: '40(8)',
    rate: 3,
    income: 4000,
    tax: 120,
  }),
]

describe('PND', () => {
  it('summarises by income type with the payee count', () => {
    const t = buildPndSummary(pnd53, 'th', L)
    expect(t.rows).toHaveLength(4)
    expect(t.rows[0].cells).toEqual(['ค่าเช่า 40(5)', '1', 20000, 1000])
    expect(t.rows[3].cells).toEqual(['total (payees 1)', '3', 29000, 1170])
  })
  it('attachment rows follow the form: seq, tax id, name, branch, date, type, rate, amounts, condition', () => {
    const t = buildPndAttachment(pnd53, 'pnd53', 'th', L)
    expect(t.rows[0].cells).toEqual([
      '1',
      '0105536000313',
      'Vendor Co',
      'headOffice',
      '2026-11-05',
      'ค่าเช่า 40(5)',
      '5%',
      20000,
      1000,
      '1',
    ])
    expect(t.rows[3].cells).toHaveLength(t.columns.length)
    expect(t.rows[3].cells.slice(-3)).toEqual([29000, 1170, null])
  })
  it('PND.3 has no branch column', () => {
    const t = buildPndAttachment([line({ condition: 'pay_always' })], 'pnd3', 'th', L)
    expect(t.columns.map((c) => c.key)).not.toContain('branch')
    expect(t.rows[0].cells.at(-1)).toBe('2')
    expect(t.rows[1].cells).toHaveLength(t.columns.length)
  })
  it('maps conditions to the form codes 1 / 2 / 3', () => {
    expect(['withhold', 'pay_always', 'pay_once'].map((c) => conditionCode(c as never))).toEqual([
      '1',
      '2',
      '3',
    ])
  })
})

describe('registers', () => {
  it('issued: voided certificates are listed but not totalled', () => {
    const t = buildIssuedRegister(
      [
        {
          id: 'a',
          number: 'W1',
          date: '2026-11-03',
          form: 'pnd3',
          contact: 'A',
          tax_id: null,
          income: 10000,
          tax: 300,
          voided: false,
        },
        {
          id: 'b',
          number: 'W2',
          date: '2026-11-12',
          form: 'pnd53',
          contact: 'B',
          tax_id: null,
          income: 1000,
          tax: 30,
          voided: true,
        },
      ],
      L,
    )
    expect(t.rows[1].cells.at(-1)).toBe('voided')
    expect(t.rows[2].cells.slice(6, 8)).toEqual([10000, 300])
  })
  it('received: flags receipts still waiting for the customer certificate', () => {
    const t = buildReceivedRegister(
      [
        {
          kind: 'document',
          source_id: 'x',
          date: '2026-11-07',
          number: 'CS-1',
          contact: 'C',
          tax_id: null,
          income: 10000,
          tax: 300,
          cert_no: null,
          cert_date: null,
        },
        {
          kind: 'payment',
          source_id: 'y',
          date: '2026-11-25',
          number: 'RV-1',
          contact: 'C',
          tax_id: null,
          income: 5000,
          tax: 150,
          cert_no: 'C-777',
          cert_date: '2026-11-26',
        },
      ],
      L,
    )
    expect(t.rows[0].cells[7]).toBe('missing')
    expect(t.rows[2].cells.slice(5, 7)).toEqual([15000, 450])
  })
})
