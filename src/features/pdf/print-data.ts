import type { DateEra } from '@/lib/format'

/** Shape returned by SQL print_document / get_shared_document. */
export interface PrintCompany {
  name: string
  name_en: string | null
  address: string | null
  tax_id: string | null
  branch_code: string
  branch_name: string | null
  phone: string | null
  email: string | null
  vat_registered: boolean
  date_era: DateEra
  /** path in the company-logos bucket (companies.logo_path) */
  logo_path?: string | null
}

export interface PrintContact {
  name: string
  tax_id: string | null
  branch_code: string
  branch_name: string | null
  address: string | null
  entity_type: 'juristic' | 'individual'
}

export interface PrintLine {
  line_no: number
  description: string
  qty: number
  unit_price: number
  discount: number
  base_amount: number
  vat_amount: number
  wht_amount: number
  item_kind: 'product' | 'service'
}

export interface PrintDocument {
  kind: 'document'
  id: string
  type: string
  number: string | null
  status: string
  doc_date: string
  due_date: string | null
  vat_mode: string
  vat_rate: number
  reference: string | null
  notes: string | null
  subtotal: number
  vat_total: number
  vat_deferred_total: number
  total: number
  wht_total: number
  net_total: number
  lines: PrintLine[]
  ref_number: string | null
  ref_date: string | null
  ref_total: number | null
}

export interface PrintPayment {
  kind: 'payment'
  id: string
  direction: 'received' | 'paid'
  number: string | null
  status: string
  pay_date: string
  amount: number
  wht_amount: number
  reference: string | null
  notes: string | null
  allocations: {
    number: string
    doc_date: string
    type: string
    total: number
    amount: number
    wht_amount: number
    vat_transferred?: number
  }[]
}

export interface PrintData {
  document: PrintDocument | PrintPayment
  company: PrintCompany
  contact: PrintContact | null
}

export interface DocTitle {
  th: string
  en: string
}

/**
 * Title printed on the document. Tax-invoice wording follows the VAT point (docs/DECISIONS.md D1):
 * service VAT on a credit invoice is due when paid, so such an invoice is not a tax invoice;
 * the receipt for it is.
 */
export function documentTitle(data: PrintData): DocTitle {
  const d = data.document
  const vat = data.company.vat_registered
  if (d.kind === 'payment') {
    if (d.direction === 'paid') return { th: 'ใบสำคัญจ่าย', en: 'Payment Voucher' }
    const taxDue = d.allocations.some((a) => Number(a.vat_transferred ?? 0) > 0)
    return vat && taxDue
      ? { th: 'ใบเสร็จรับเงิน / ใบกำกับภาษี', en: 'Receipt / Tax Invoice' }
      : { th: 'ใบเสร็จรับเงิน', en: 'Receipt' }
  }
  switch (d.type) {
    case 'quotation':
      return { th: 'ใบเสนอราคา', en: 'Quotation' }
    case 'invoice':
      return vat && Number(d.vat_total) > 0 && Number(d.vat_deferred_total) === 0
        ? { th: 'ใบแจ้งหนี้ / ใบกำกับภาษี', en: 'Invoice / Tax Invoice' }
        : { th: 'ใบแจ้งหนี้', en: 'Invoice' }
    case 'cash_sale':
      return vat
        ? { th: 'ใบกำกับภาษี / ใบเสร็จรับเงิน', en: 'Tax Invoice / Receipt' }
        : { th: 'ใบเสร็จรับเงิน', en: 'Receipt' }
    case 'credit_note':
      return vat
        ? { th: 'ใบลดหนี้ / ใบกำกับภาษี', en: 'Credit Note / Tax Invoice' }
        : { th: 'ใบลดหนี้', en: 'Credit Note' }
    case 'debit_note':
      return vat
        ? { th: 'ใบเพิ่มหนี้ / ใบกำกับภาษี', en: 'Debit Note / Tax Invoice' }
        : { th: 'ใบเพิ่มหนี้', en: 'Debit Note' }
    case 'purchase_order':
      return { th: 'ใบสั่งซื้อ', en: 'Purchase Order' }
    case 'bill':
      return { th: 'บันทึกค่าใช้จ่าย', en: 'Expense Record' }
    case 'cash_purchase':
      return { th: 'บันทึกซื้อเงินสด', en: 'Cash Purchase Record' }
    default:
      return { th: d.type, en: d.type }
  }
}

/** "สำนักงานใหญ่" or "สาขาที่ 00001 (name)" — required on Thai tax invoices. */
export function branchLabel(branchCode: string, branchName: string | null): string {
  if (branchCode === '00000') return 'สำนักงานใหญ่'
  return `สาขาที่ ${branchCode}${branchName ? ` (${branchName})` : ''}`
}
