import { branchLabel, documentTitle, type PrintData, type PrintDocument } from './print-data'

const company = {
  name: 'A',
  name_en: null,
  address: null,
  tax_id: '0105536000313',
  branch_code: '00000',
  branch_name: null,
  phone: null,
  email: null,
  vat_registered: true,
  date_era: 'BE' as const,
}
const doc = (over: Partial<PrintDocument>): PrintData => ({
  company,
  contact: null,
  document: {
    kind: 'document',
    id: 'd',
    type: 'invoice',
    number: 'INV-2026-0001',
    status: 'posted',
    doc_date: '2026-11-25',
    due_date: null,
    vat_mode: 'exclusive',
    vat_rate: 7,
    reference: null,
    notes: null,
    subtotal: 100,
    vat_total: 7,
    vat_deferred_total: 0,
    total: 107,
    wht_total: 0,
    net_total: 107,
    lines: [],
    ref_number: null,
    ref_date: null,
    ref_total: null,
    ...over,
  },
})

describe('documentTitle', () => {
  it('goods invoice of a VAT company is a tax invoice', () => {
    expect(documentTitle(doc({})).th).toBe('ใบแจ้งหนี้ / ใบกำกับภาษี')
  })
  it('service invoice with deferred VAT is not a tax invoice (D1)', () => {
    expect(documentTitle(doc({ vat_deferred_total: 7 })).th).toBe('ใบแจ้งหนี้')
  })
  it('the receipt that realises deferred VAT is the tax invoice', () => {
    const data: PrintData = {
      company,
      contact: null,
      document: {
        kind: 'payment',
        id: 'p',
        direction: 'received',
        number: 'RV-2026-0001',
        status: 'posted',
        pay_date: '2026-11-26',
        amount: 107,
        wht_amount: 0,
        reference: null,
        notes: null,
        allocations: [
          {
            number: 'INV',
            doc_date: '',
            type: 'invoice',
            total: 107,
            amount: 107,
            wht_amount: 0,
            vat_transferred: 7,
          },
        ],
      },
    }
    expect(documentTitle(data).th).toBe('ใบเสร็จรับเงิน / ใบกำกับภาษี')
  })
  it('non-VAT companies never print "tax invoice"', () => {
    const d = doc({ type: 'cash_sale' })
    d.company = { ...company, vat_registered: false }
    expect(documentTitle(d).th).toBe('ใบเสร็จรับเงิน')
  })
})

describe('branchLabel', () => {
  it('formats head office and branches', () => {
    expect(branchLabel('00000', null)).toBe('สำนักงานใหญ่')
    expect(branchLabel('00002', 'บางนา')).toBe('สาขาที่ 00002 (บางนา)')
  })
})
