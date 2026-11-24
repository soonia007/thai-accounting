import { parseBool, parseMoney, type CsvRow, type ImportPlan, type RowError } from '@/lib/csv'
import type { Enums, Tables } from '@/lib/supabase'

export type Product = Tables<'products'>
type Account = Pick<Tables<'accounts'>, 'id' | 'code' | 'type' | 'is_group' | 'is_active'>

export const PRODUCT_COLUMNS = [
  'code',
  'name',
  'kind',
  'unit',
  'sale_price',
  'purchase_price',
  'vat_type',
  'income_account_code',
  'expense_account_code',
  'description',
  'is_active',
] as const

const KINDS: Record<string, Enums<'product_kind'>> = {
  product: 'product',
  service: 'service',
  สินค้า: 'product',
  บริการ: 'service',
}
const VAT_TYPES: Record<string, Enums<'product_vat_type'>> = {
  standard: 'standard',
  zero: 'zero',
  exempt: 'exempt',
  '7%': 'standard',
  '0%': 'zero',
  ปกติ: 'standard',
  ยกเว้น: 'exempt',
}

export interface ProductImportRow {
  code: string | null
  name: string
  kind: Enums<'product_kind'>
  unit: string | null
  sale_price: number | null
  purchase_price: number | null
  vat_type: Enums<'product_vat_type'>
  income_account_id: string | null
  expense_account_id: string | null
  description: string | null
  is_active: boolean
}

const orNull = (v: string | undefined) => (v ? v : null)
const postable = (a: Account) => !a.is_group && a.is_active

export function planProductImport(
  headers: string[],
  rows: CsvRow[],
  accounts: Account[],
): ImportPlan<ProductImportRow> {
  const missingColumns = ['name'].filter((c) => !headers.includes(c))
  if (missingColumns.length) return { valid: [], errors: [], missingColumns }

  const byCode = new Map(accounts.map((a) => [a.code, a]))
  const errors: RowError[] = []
  const valid: ProductImportRow[] = []
  const seenCodes = new Set<string>()

  rows.forEach((r, i) => {
    const row = i + 2
    const rowErrors: RowError[] = []
    const err = (field: string, code: string) => rowErrors.push({ row, field, code })

    const code = orNull(r.code)
    if (!r.name) err('name', 'required')
    if (code) {
      if (seenCodes.has(code)) err('code', 'duplicateInFile')
      seenCodes.add(code)
    }
    const kind = r.kind ? KINDS[r.kind.toLowerCase()] : 'service'
    if (!kind) err('kind', 'invalidValue')
    const vatType = r.vat_type ? VAT_TYPES[r.vat_type.toLowerCase()] : 'standard'
    if (!vatType) err('vat_type', 'invalidValue')

    const sale = parseMoney(r.sale_price)
    if (sale !== null && (Number.isNaN(sale) || sale < 0)) err('sale_price', 'money')
    const purchase = parseMoney(r.purchase_price)
    if (purchase !== null && (Number.isNaN(purchase) || purchase < 0))
      err('purchase_price', 'money')

    let income: Account | undefined
    if (r.income_account_code) {
      income = byCode.get(r.income_account_code)
      if (!income) err('income_account_code', 'accountNotFound')
      else if (income.type !== 'revenue' || !postable(income))
        err('income_account_code', 'accountInvalid')
    }
    let expense: Account | undefined
    if (r.expense_account_code) {
      expense = byCode.get(r.expense_account_code)
      if (!expense) err('expense_account_code', 'accountNotFound')
      else if (!['expense', 'asset'].includes(expense.type) || !postable(expense))
        err('expense_account_code', 'accountInvalid')
    }

    const isActive = parseBool(r.is_active, true)
    if (isActive === null) err('is_active', 'invalidValue')

    if (rowErrors.length) {
      errors.push(...rowErrors)
      return
    }
    valid.push({
      code,
      name: r.name,
      kind: kind!,
      unit: orNull(r.unit),
      sale_price: sale,
      purchase_price: purchase,
      vat_type: vatType!,
      income_account_id: income?.id ?? null,
      expense_account_id: expense?.id ?? null,
      description: orNull(r.description),
      is_active: isActive!,
    })
  })

  return { valid, errors, missingColumns: [] }
}

/** Rows for export (account ids → codes so the file can be re-imported). */
export function productsToCsvRows(products: Product[], accounts: Pick<Account, 'id' | 'code'>[]) {
  const codeById = new Map(accounts.map((a) => [a.id, a.code]))
  return products.map((p) => ({
    ...p,
    income_account_code: p.income_account_id ? codeById.get(p.income_account_id) : '',
    expense_account_code: p.expense_account_id ? codeById.get(p.expense_account_id) : '',
  }))
}
