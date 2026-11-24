import { bankName, suggestLedgerCode } from './banks'

describe('suggestLedgerCode', () => {
  it('returns the next unused code after the base', () => {
    expect(suggestLedgerCode('1120', new Set(['1120']))).toBe('1121')
    expect(suggestLedgerCode('1120', new Set(['1120', '1121', '1122']))).toBe('1123')
  })
  it('keeps leading zeros and handles non-numeric bases', () => {
    expect(suggestLedgerCode('0099', new Set())).toBe('0100')
    expect(suggestLedgerCode('BANK', new Set())).toBe('')
    expect(suggestLedgerCode(undefined, new Set())).toBe('')
  })
})

describe('bankName', () => {
  it('localizes known banks and falls back to the code', () => {
    expect(bankName('KBANK', 'th')).toBe('ธนาคารกสิกรไทย')
    expect(bankName('KBANK', 'en')).toBe('Kasikornbank')
    expect(bankName('XYZ', 'th')).toBe('XYZ')
  })
})
