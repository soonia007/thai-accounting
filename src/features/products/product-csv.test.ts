import { planProductImport, productsToCsvRows, type Product } from './product-csv'

const accounts = [
  { id: 'rev', code: '4100', type: 'revenue' as const, is_group: false, is_active: true },
  { id: 'grp', code: '4000', type: 'revenue' as const, is_group: true, is_active: true },
  { id: 'exp', code: '5110', type: 'expense' as const, is_group: false, is_active: true },
  { id: 'eq', code: '1210', type: 'asset' as const, is_group: false, is_active: true },
]
const headers = [
  'code',
  'name',
  'kind',
  'sale_price',
  'income_account_code',
  'expense_account_code',
]

describe('planProductImport', () => {
  it('maps account codes to ids and parses prices', () => {
    const plan = planProductImport(
      headers,
      [
        {
          name: 'สินค้า',
          kind: 'สินค้า',
          sale_price: '1,200.50',
          income_account_code: '4100',
          expense_account_code: '1210',
        },
      ],
      accounts,
    )
    expect(plan.errors).toEqual([])
    expect(plan.valid[0]).toMatchObject({
      kind: 'product',
      sale_price: 1200.5,
      vat_type: 'standard',
      income_account_id: 'rev',
      expense_account_id: 'eq',
    })
  })

  it('rejects unknown, group and wrong-type accounts and bad prices', () => {
    const plan = planProductImport(
      headers,
      [
        { name: 'a', income_account_code: '9999' },
        { name: 'b', income_account_code: '4000' },
        { name: 'c', expense_account_code: '4100' },
        { name: 'd', sale_price: '-5' },
      ],
      accounts,
    )
    expect(plan.valid).toEqual([])
    expect(plan.errors.map((e) => [e.row, e.code])).toEqual([
      [2, 'accountNotFound'],
      [3, 'accountInvalid'],
      [4, 'accountInvalid'],
      [5, 'money'],
    ])
  })
})

describe('productsToCsvRows', () => {
  it('exports account codes instead of ids', () => {
    const rows = productsToCsvRows(
      [{ income_account_id: 'rev', expense_account_id: null } as Product],
      accounts,
    )
    expect(rows[0]).toMatchObject({ income_account_code: '4100', expense_account_code: '' })
  })
})
