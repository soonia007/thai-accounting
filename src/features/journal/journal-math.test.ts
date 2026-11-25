import { journalBalance, journalPayload, toSatang } from './journal-math'

const line = (debit: string, credit: string, account_id = 'a') => ({
  account_id,
  description: '',
  debit,
  credit,
})

describe('journal math', () => {
  it('parses amounts with thousands separators', () => {
    expect(toSatang('1,234.56')).toBe(123456)
    expect(toSatang('')).toBe(0)
    expect(toSatang('abc')).toBe(0)
  })
  it('balances without floating-point drift', () => {
    const b = journalBalance([line('0.1', ''), line('0.2', ''), line('', '0.3')])
    expect(b).toMatchObject({ debit: 0.3, credit: 0.3, difference: 0, balanced: true, used: 3 })
  })
  it('reports the difference when unbalanced', () => {
    expect(journalBalance([line('1000', ''), line('', '900')])).toMatchObject({
      difference: 100,
      balanced: false,
    })
  })
  it('needs two lines with amounts to be balanced', () => {
    expect(journalBalance([line('', ''), line('', '')]).balanced).toBe(false)
  })
  it('builds the payload with numbers', () => {
    const p = journalPayload('co', {
      entry_date: '2026-11-30',
      memo: 'm',
      reference: '',
      lines: [line('1,000', '')],
    })
    expect(p.lines[0]).toEqual({ account_id: 'a', description: '', debit: 1000, credit: 0 })
  })
})
