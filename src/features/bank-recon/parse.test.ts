import { describe, expect, it } from 'vitest'
import { guessMapping, parseDate, parseMoney, toLines, toSheet } from './parse'

describe('parseMoney', () => {
  it('reads bank number formats', () => {
    expect(parseMoney('1,234.50')).toBe(1234.5)
    expect(parseMoney('(1,234.50)')).toBe(-1234.5)
    expect(parseMoney('1,234.50-')).toBe(-1234.5)
    expect(parseMoney('฿ 99')).toBe(99)
    expect(parseMoney('')).toBeNull()
    expect(parseMoney('abc')).toBeNull()
  })
})

describe('parseDate', () => {
  it('handles d/m/y, BE years, 2-digit years and ISO', () => {
    expect(parseDate('05/11/2569', 'dmy')).toBe('2026-11-05')
    expect(parseDate('5-11-26', 'dmy')).toBe('2026-11-05')
    expect(parseDate('05/11/69', 'dmy')).toBe('2026-11-05')
    expect(parseDate('11/05/2026', 'mdy')).toBe('2026-11-05')
    expect(parseDate('2026-11-05T00:00:00.000Z', 'dmy')).toBe('2026-11-05')
    expect(parseDate('31/02/2026', 'dmy')).toBeNull()
  })
})

describe('statement mapping', () => {
  const sheet = toSheet([
    ['KBank statement', '', '', ''],
    ['วันที่', 'รายการ', 'ถอนเงิน', 'ฝากเงิน', 'ยอดคงเหลือ'],
    ['04/11/2569', 'TRANSFER IN', '', '5,000.00', '5,000.00'],
    ['06/11/2569', 'PAYMENT', '1,200.00', '', '3,800.00'],
    ['', '', '', '', ''],
    ['bad date', 'X', '1', '', ''],
  ])
  it('finds the header row below title lines and guesses the columns', () => {
    expect(sheet.headers[0]).toBe('วันที่')
    const m = guessMapping(sheet.headers)
    expect(m).toMatchObject({
      date: 'วันที่',
      description: 'รายการ',
      withdrawal: 'ถอนเงิน',
      deposit: 'ฝากเงิน',
      balance: 'ยอดคงเหลือ',
    })
  })
  it('signs money in (+) and out (−), and reports unreadable rows', () => {
    const r = toLines(sheet, guessMapping(sheet.headers))
    expect(r.lines).toEqual([
      {
        txn_date: '2026-11-04',
        description: 'TRANSFER IN',
        reference: null,
        amount: 5000,
        balance: 5000,
      },
      {
        txn_date: '2026-11-06',
        description: 'PAYMENT',
        reference: null,
        amount: -1200,
        balance: 3800,
      },
    ])
    expect(r.skipped).toEqual([4])
  })
  it('supports one signed amount column', () => {
    const s = toSheet([
      ['Date', 'Description', 'Amount'],
      ['2026-11-30', 'FEE', '-50'],
    ])
    const r = toLines(s, {
      date: 'Date',
      description: 'Description',
      amount: 'Amount',
      dateOrder: 'ymd',
    })
    expect(r.lines[0].amount).toBe(-50)
  })
})
