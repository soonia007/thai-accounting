import type { WhtCondition } from '@/features/documents/payment-math'

/** Shape returned by SQL public.print_wht_certificate(). */
export interface WhtCertificateData {
  id: string
  number: string
  cert_date: string
  form: 'pnd3' | 'pnd53'
  condition: WhtCondition
  total_income: number
  total_tax: number
  voided: boolean
  source_number: string | null
  payer: { name: string; tax_id: string | null; address: string | null; branch_code: string | null }
  payee: {
    name: string
    tax_id: string | null
    address: string | null
    entity_type: 'juristic' | 'individual'
    branch_code: string | null
  }
  lines: {
    income_type: string
    name_th: string
    name_en: string
    section: string
    form_row: string
    rate: number
    income_amount: number
    tax_amount: number
  }[]
}
