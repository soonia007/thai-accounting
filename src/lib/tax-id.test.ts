import { isValidThaiTaxId, normalizeTaxId } from './tax-id'

describe('isValidThaiTaxId', () => {
  it('accepts a valid ID', () => {
    expect(isValidThaiTaxId('0105536000313')).toBe(true)
    expect(isValidThaiTaxId('1234567890121')).toBe(true)
  })

  it('rejects a wrong check digit', () => {
    expect(isValidThaiTaxId('0105536000314')).toBe(false)
  })

  it('rejects wrong length or non-digits', () => {
    expect(isValidThaiTaxId('010553600031')).toBe(false)
    expect(isValidThaiTaxId('01055360003131')).toBe(false)
    expect(isValidThaiTaxId('010553600031a')).toBe(false)
    expect(isValidThaiTaxId('')).toBe(false)
  })
})

describe('normalizeTaxId', () => {
  it('removes dashes and spaces', () => {
    expect(normalizeTaxId('0-1055-36000-31-3')).toBe('0105536000313')
    expect(normalizeTaxId(' 0105 5360 00313 ')).toBe('0105536000313')
  })
})
