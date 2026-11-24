import th from '@/i18n/locales/th.json'
import { normalBalance, plainSentence, type SimLine } from './simulation'

const line = (over: Partial<SimLine>): SimLine => ({
  account_id: 'a',
  code: '1130',
  name_th: 'ลูกหนี้การค้า',
  name_en: 'AR',
  type: 'asset',
  role: null,
  debit: 0,
  credit: 0,
  sources: [],
  opening_balance: 0,
  ...over,
})

const lookup = (key: string) =>
  key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], th)

describe('plainSentence', () => {
  it('uses the account role and side', () => {
    expect(plainSentence(line({ role: 'AR', debit: 10700 })).key).toBe('plain.role.AR.dr')
    expect(plainSentence(line({ role: 'OUTPUT_VAT_DEFERRED', credit: 700 })).key).toBe(
      'plain.role.OUTPUT_VAT_DEFERRED.cr',
    )
  })

  it('treats payment accounts as money in/out', () => {
    expect(plainSentence(line({ sources: ['payment'], debit: 1 })).key).toBe('plain.money.dr')
  })

  it('falls back to the account type for user accounts', () => {
    expect(plainSentence(line({ type: 'expense', debit: 1, sources: ['line'] })).key).toBe(
      'plain.type.expense.dr',
    )
  })

  it('has a Thai sentence for every role, side and type the engine can produce', () => {
    const roles = [
      'AR',
      'AP',
      'OUTPUT_VAT',
      'OUTPUT_VAT_DEFERRED',
      'INPUT_VAT',
      'INPUT_VAT_DEFERRED',
      'WHT_RECEIVABLE',
      'WHT_PAYABLE',
      'SALES_REVENUE',
      'SALES_RETURNS',
      'DEFAULT_EXPENSE',
      'BANK',
      'CASH',
    ]
    const keys = [
      ...roles.flatMap((r) => [`plain.role.${r}.dr`, `plain.role.${r}.cr`]),
      'plain.money.dr',
      'plain.money.cr',
      ...['asset', 'liability', 'equity', 'revenue', 'expense'].flatMap((ty) => [
        `plain.type.${ty}.dr`,
        `plain.type.${ty}.cr`,
      ]),
    ]
    expect(keys.filter((k) => typeof lookup(k) !== 'string')).toEqual([])
  })
})

describe('normalBalance', () => {
  it('shows asset/expense as debit balances and the rest as credit balances', () => {
    expect(normalBalance('asset', 100)).toBe(100)
    expect(normalBalance('revenue', -100)).toBe(100)
    expect(normalBalance('liability', -50)).toBe(50)
    expect(Object.is(normalBalance('revenue', 0), 0)).toBe(true)
  })
})
