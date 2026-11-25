import { addDays, bahtText, formatDate, formatMoney } from './format'

describe('bahtText (Excel BAHTTEXT convention)', () => {
  it.each([
    [0, 'ศูนย์บาทถ้วน'],
    [1, 'หนึ่งบาทถ้วน'],
    [11, 'สิบเอ็ดบาทถ้วน'],
    [21, 'ยี่สิบเอ็ดบาทถ้วน'],
    [101, 'หนึ่งร้อยเอ็ดบาทถ้วน'],
    [1000, 'หนึ่งพันบาทถ้วน'],
    [10700, 'หนึ่งหมื่นเจ็ดร้อยบาทถ้วน'],
    [1_000_000, 'หนึ่งล้านบาทถ้วน'],
    [1_000_001, 'หนึ่งล้านเอ็ดบาทถ้วน'],
    [21_000_000, 'ยี่สิบเอ็ดล้านบาทถ้วน'],
    [1.5, 'หนึ่งบาทห้าสิบสตางค์'],
    [0.21, 'ยี่สิบเอ็ดสตางค์'],
    [0.01, 'หนึ่งสตางค์'],
    [1234567.89, 'หนึ่งล้านสองแสนสามหมื่นสี่พันห้าร้อยหกสิบเจ็ดบาทแปดสิบเก้าสตางค์'],
    ['1166.28', 'หนึ่งพันหนึ่งร้อยหกสิบหกบาทยี่สิบแปดสตางค์'],
    [-5, 'ลบห้าบาทถ้วน'],
  ])('%s → %s', (n, words) => {
    expect(bahtText(n)).toBe(words)
  })
})

describe('formatDate', () => {
  it('shows Buddhist Era by default', () => {
    expect(formatDate('2026-11-25')).toBe('25/11/2569')
    expect(formatDate('2026-11-25', 'CE')).toBe('25/11/2026')
    expect(formatDate('2026-11-25', 'BE', 'long')).toBe('25 พฤศจิกายน 2569')
    expect(formatDate('2026-01-05', 'CE', 'long', 'en')).toBe('5 January 2026')
    expect(formatDate(null)).toBe('—')
  })
})

describe('formatMoney / addDays', () => {
  it('formats with two decimals', () => {
    expect(formatMoney(10700)).toBe('10,700.00')
    expect(formatMoney('0.5', 'en')).toBe('0.50')
    expect(formatMoney(null)).toBe('—')
  })
  it('adds days across months and years', () => {
    expect(addDays('2026-11-25', 30)).toBe('2026-12-25')
    expect(addDays('2026-12-15', 30)).toBe('2027-01-14')
  })
})
