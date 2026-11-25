import {
  calcDocument,
  NegativeLineError,
  type DocumentTotals,
  type VatMode,
} from '@/lib/money/calc'
import type { DocType } from './doc-types'
import type { DocumentLine, DocumentRow } from './queries'

export interface LineForm {
  product_id: string
  description: string
  item_kind: 'product' | 'service'
  qty: string
  unit_price: string
  discount: string
  vat_type: 'standard' | 'zero' | 'exempt'
  wht_rate: string
  account_id: string
}

export interface DocForm {
  contact_id: string
  doc_date: string
  due_date: string
  vat_mode: VatMode
  payment_account_id: string
  ref_document_id: string
  reference: string
  notes: string
  lines: LineForm[]
}

export const emptyLine = (): LineForm => ({
  product_id: '',
  description: '',
  item_kind: 'service',
  qty: '1',
  unit_price: '',
  discount: '',
  vat_type: 'standard',
  wht_rate: '0',
  account_id: '',
})

const num = (v: string) => {
  const s = v.replace(/,/g, '').trim()
  if (s === '') return 0
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}
const orNull = (v: string) => (v ? v : null)

export interface CompanyVat {
  vat_registered: boolean
  vat_rate: number
}

export const effectiveVatMode = (form: Pick<DocForm, 'vat_mode'>, co: CompanyVat): VatMode =>
  co.vat_registered ? form.vat_mode : 'none'

/** Payload for save_document / simulate_posting (same shape as the SQL engine expects). */
export function toPayload(
  companyId: string,
  type: DocType,
  form: DocForm,
  co: CompanyVat,
  id?: string,
) {
  return {
    ...(id ? { id } : {}),
    company_id: companyId,
    type,
    doc_date: form.doc_date,
    due_date: orNull(form.due_date),
    contact_id: orNull(form.contact_id),
    vat_mode: effectiveVatMode(form, co),
    payment_account_id: orNull(form.payment_account_id),
    ref_document_id: orNull(form.ref_document_id),
    reference: orNull(form.reference),
    notes: orNull(form.notes),
    lines: form.lines
      .filter((l) => l.description.trim() || l.product_id || num(l.unit_price) > 0)
      .map((l) => ({
        product_id: orNull(l.product_id),
        description: l.description,
        item_kind: l.item_kind,
        qty: num(l.qty),
        unit_price: num(l.unit_price),
        discount: num(l.discount),
        vat_type: l.vat_type,
        wht_rate: num(l.wht_rate),
        account_id: orNull(l.account_id),
      })),
  }
}

/** Instant client-side totals (mirror of SQL calc_line); null when a line is invalid. */
export function formTotals(form: DocForm, co: CompanyVat): DocumentTotals | null {
  const mode = effectiveVatMode(form, co)
  try {
    return calcDocument(
      form.lines.map((l) => ({
        qty: num(l.qty),
        unitPrice: num(l.unit_price),
        discount: num(l.discount),
        vatRate: mode === 'none' || l.vat_type !== 'standard' ? 0 : co.vat_rate,
        whtRate: num(l.wht_rate),
        itemKind: l.item_kind,
      })),
      mode,
    )
  } catch (e) {
    if (e instanceof NegativeLineError) return null
    throw e
  }
}

const str = (n: number | null | undefined) =>
  n === null || n === undefined ? '' : String(Number(n))

/** Stored document → form (also used to prefill conversions). */
export function docToForm(doc: DocumentRow, lines: DocumentLine[]): DocForm {
  return {
    contact_id: doc.contact_id ?? '',
    doc_date: doc.doc_date,
    due_date: doc.due_date ?? '',
    vat_mode: doc.vat_mode,
    payment_account_id: doc.payment_account_id ?? '',
    ref_document_id: doc.ref_document_id ?? '',
    reference: doc.reference ?? '',
    notes: doc.notes ?? '',
    lines: lines.map((l) => ({
      product_id: l.product_id ?? '',
      description: l.description,
      item_kind: l.item_kind,
      qty: str(l.qty),
      unit_price: str(l.unit_price),
      discount: Number(l.discount) ? str(l.discount) : '',
      vat_type: l.vat_type,
      wht_rate: str(l.wht_rate),
      account_id: l.account_id ?? '',
    })),
  }
}
