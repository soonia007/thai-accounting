import { parseBool, type CsvRow, type ImportPlan, type RowError } from '@/lib/csv'
import type { Enums, Tables } from '@/lib/supabase'
import { isValidThaiTaxId, normalizeTaxId } from '@/lib/tax-id'

export type Contact = Tables<'contacts'>

export const CONTACT_COLUMNS = [
  'code',
  'name',
  'contact_type',
  'entity_type',
  'tax_id',
  'branch_code',
  'branch_name',
  'address',
  'contact_person',
  'phone',
  'email',
  'credit_term_days',
  'notes',
  'is_active',
] as const

const REQUIRED = ['name'] as const

const CONTACT_TYPES: Record<string, Enums<'contact_type'>> = {
  customer: 'customer',
  vendor: 'vendor',
  both: 'both',
  ลูกค้า: 'customer',
  ผู้ขาย: 'vendor',
  ผู้จำหน่าย: 'vendor',
  ทั้งคู่: 'both',
  'ลูกค้า/ผู้ขาย': 'both',
}
const ENTITY_TYPES: Record<string, Enums<'entity_type'>> = {
  juristic: 'juristic',
  individual: 'individual',
  นิติบุคคล: 'juristic',
  บุคคลธรรมดา: 'individual',
}

export interface ContactImportRow {
  code: string | null
  name: string
  contact_type: Enums<'contact_type'>
  entity_type: Enums<'entity_type'>
  tax_id: string | null
  branch_code: string
  branch_name: string | null
  address: string | null
  contact_person: string | null
  phone: string | null
  email: string | null
  credit_term_days: number
  notes: string | null
  is_active: boolean
}

const orNull = (v: string | undefined) => (v ? v : null)

/**
 * Validate CSV rows before import. Rows with a code update the existing contact with that code;
 * rows without a code are inserted with an auto code.
 */
export function planContactImport(
  headers: string[],
  rows: CsvRow[],
  existing: Pick<Contact, 'code' | 'tax_id' | 'branch_code'>[],
): ImportPlan<ContactImportRow> {
  const missingColumns = REQUIRED.filter((c) => !headers.includes(c))
  if (missingColumns.length) return { valid: [], errors: [], missingColumns }

  const errors: RowError[] = []
  const valid: ContactImportRow[] = []
  const seenCodes = new Set<string>()
  const seenTax = new Set<string>()
  // tax id + branch → code of the existing contact that owns it
  const taxOwner = new Map(
    existing.filter((c) => c.tax_id).map((c) => [`${c.tax_id}|${c.branch_code}`, c.code]),
  )

  rows.forEach((r, i) => {
    const row = i + 2
    const rowErrors: RowError[] = []
    const err = (field: string, code: string) => rowErrors.push({ row, field, code })

    const code = orNull(r.code)
    const name = r.name ?? ''
    if (!name) err('name', 'required')
    if (code) {
      if (seenCodes.has(code)) err('code', 'duplicateInFile')
      seenCodes.add(code)
    }

    const contactType = r.contact_type ? CONTACT_TYPES[r.contact_type.toLowerCase()] : 'customer'
    if (!contactType) err('contact_type', 'invalidValue')
    const entityType = r.entity_type ? ENTITY_TYPES[r.entity_type.toLowerCase()] : 'juristic'
    if (!entityType) err('entity_type', 'invalidValue')

    const taxId = r.tax_id ? normalizeTaxId(r.tax_id) : null
    if (taxId && !isValidThaiTaxId(taxId)) err('tax_id', 'taxId')

    let branch = r.branch_code || '00000'
    if (/^\d{1,5}$/.test(branch)) branch = branch.padStart(5, '0')
    else err('branch_code', 'branchCode')

    if (taxId) {
      const key = `${taxId}|${branch}`
      if (seenTax.has(key)) err('tax_id', 'duplicateInFile')
      seenTax.add(key)
      const owner = taxOwner.get(key)
      if (owner && owner !== code) err('tax_id', 'taxIdExists')
    }

    const term = r.credit_term_days ? Number(r.credit_term_days) : 0
    if (!Number.isInteger(term) || term < 0 || term > 365) err('credit_term_days', 'creditTerm')

    if (r.email && !/^[^@\s]+@[^@\s]+$/.test(r.email)) err('email', 'email')

    const isActive = parseBool(r.is_active, true)
    if (isActive === null) err('is_active', 'invalidValue')

    if (rowErrors.length) {
      errors.push(...rowErrors)
      return
    }
    valid.push({
      code,
      name,
      contact_type: contactType!,
      entity_type: entityType!,
      tax_id: taxId,
      branch_code: branch,
      branch_name: orNull(r.branch_name),
      address: orNull(r.address),
      contact_person: orNull(r.contact_person),
      phone: orNull(r.phone),
      email: orNull(r.email),
      credit_term_days: term,
      notes: orNull(r.notes),
      is_active: isActive!,
    })
  })

  return { valid, errors, missingColumns: [] }
}
