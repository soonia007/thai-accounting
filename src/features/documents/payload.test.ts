import { emptyLine, formTotals, toPayload, type DocForm } from './payload'

const vatCo = { vat_registered: true, vat_rate: 7 }
const form = (over: Partial<DocForm> = {}): DocForm => ({
  contact_id: 'c1',
  doc_date: '2026-11-25',
  due_date: '',
  vat_mode: 'exclusive',
  payment_account_id: '',
  ref_document_id: '',
  wht_condition: 'withhold',
  reference: '',
  notes: '',
  tax_invoice_no: '',
  tax_invoice_date: '',
  vat_claim_month: '',
  restock: true,
  lines: [{ ...emptyLine(), description: 'ออกแบบ', unit_price: '10,000', wht_rate: '3' }],
  ...over,
})

describe('toPayload', () => {
  it('sends the vendor tax invoice and claim month on purchases only (D12)', () => {
    const f = form({
      tax_invoice_no: ' TX-1 ',
      tax_invoice_date: '2026-11-20',
      vat_claim_month: '2026-12',
    })
    expect(toPayload('co', 'bill', f, vatCo)).toMatchObject({
      tax_invoice_no: 'TX-1',
      tax_invoice_date: '2026-11-20',
      vat_claim_month: '2026-12-01',
    })
    expect(toPayload('co', 'invoice', f, vatCo)).not.toHaveProperty('tax_invoice_no')
  })
  it('passes the per-line claimable flag (D11)', () => {
    const f = form({ lines: [{ ...emptyLine(), unit_price: '100', vat_claimable: false }] })
    expect(toPayload('co', 'cash_purchase', f, vatCo).lines[0].vat_claimable).toBe(false)
  })

  it('normalizes numbers and empty strings', () => {
    const p = toPayload('co', 'invoice', form(), vatCo)
    expect(p).toMatchObject({
      company_id: 'co',
      type: 'invoice',
      due_date: null,
      payment_account_id: null,
      vat_mode: 'exclusive',
    })
    expect(p.lines[0]).toMatchObject({ qty: 1, unit_price: 10000, discount: 0, wht_rate: 3 })
  })

  it('drops blank lines and forces no VAT for non-VAT companies', () => {
    const p = toPayload('co', 'invoice', form({ lines: [...form().lines, emptyLine()] }), {
      vat_registered: false,
      vat_rate: 7,
    })
    expect(p.lines).toHaveLength(1)
    expect(p.vat_mode).toBe('none')
  })
})

describe('formTotals', () => {
  it('computes totals like the DB engine', () => {
    expect(formTotals(form(), vatCo)).toMatchObject({
      subtotal: 10000,
      vatTotal: 700,
      total: 10700,
      whtTotal: 300,
      netTotal: 10400,
    })
  })

  it('applies 0% to zero-rated / exempt lines', () => {
    const f = form({ lines: [{ ...form().lines[0], vat_type: 'exempt', wht_rate: '0' }] })
    expect(formTotals(f, vatCo)).toMatchObject({ vatTotal: 0, total: 10000 })
  })

  it('returns null when a discount exceeds the line', () => {
    const f = form({ lines: [{ ...form().lines[0], discount: '20000' }] })
    expect(formTotals(f, vatCo)).toBeNull()
  })
})
