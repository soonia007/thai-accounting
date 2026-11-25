import type { Enums } from '@/lib/supabase'

export type DocType = Enums<'document_type'>
export type DocStatus = Enums<'document_status'>
export type Direction = 'sales' | 'purchases'

export const SALES_TYPES: DocType[] = [
  'quotation',
  'invoice',
  'cash_sale',
  'credit_note',
  'debit_note',
]
export const PURCHASE_TYPES: DocType[] = ['purchase_order', 'bill', 'cash_purchase']

export const directionOf = (type: DocType): Direction =>
  PURCHASE_TYPES.includes(type) ? 'purchases' : 'sales'

/** Types the user can start from the "new" menu (notes start from an invoice). */
export const CREATABLE: Record<Direction, DocType[]> = {
  sales: ['quotation', 'invoice', 'cash_sale'],
  purchases: ['purchase_order', 'bill', 'cash_purchase'],
}

/** Paid immediately: needs a cash/bank account and has no "next step". */
export const isCashType = (t: DocType) => t === 'cash_sale' || t === 'cash_purchase'
/** Has a settlement later (receivable / payable). */
export const isCreditType = (t: DocType) => t === 'invoice' || t === 'debit_note' || t === 'bill'
export const isNoteType = (t: DocType) => t === 'credit_note' || t === 'debit_note'
/** Does not post to the books. */
export const isNonPosting = (t: DocType) => t === 'quotation' || t === 'purchase_order'

/** Where each document type can be converted to (spec M5 "ปุ่มแปลงเอกสาร"). */
export const CONVERSIONS: Partial<Record<DocType, DocType[]>> = {
  quotation: ['invoice', 'cash_sale'],
  invoice: ['credit_note', 'debit_note'],
  purchase_order: ['bill', 'cash_purchase'],
}

export const basePath = (d: Direction) => (d === 'sales' ? '/sales' : '/purchases')
