import { defaultWht, paidAmount, paymentAmount, settlementWht, totalWht } from './payment-math'

const inv = { id: 'i', total: 10700, wht_total: 300, outstanding: 10700 }

describe('defaultWht', () => {
  it('takes the full WHT on full settlement', () => {
    expect(defaultWht(inv, 10700)).toBe(300)
  })
  it('is proportional on partial settlement', () => {
    expect(defaultWht(inv, 5350)).toBe(150)
    expect(defaultWht(inv, 1000)).toBe(28.04) // 300 × 1000 / 10700 = 28.037…
  })
  it('is zero when the document has no WHT', () => {
    expect(defaultWht({ ...inv, wht_total: 0 }, 10700)).toBe(0)
  })
})

describe('paymentAmount / totalWht', () => {
  it('money moved = settled − WHT, exact to the satang', () => {
    const allocs = [
      { amount: 10700, wht_amount: 300 },
      { amount: 0.1, wht_amount: 0 },
      { amount: 0.2, wht_amount: 0 },
    ]
    expect(paymentAmount(allocs)).toBe(10400.3)
    expect(totalWht(allocs)).toBe(300)
  })
})

describe('settlementWht (same numbers as supabase/tests/06_m6_purchases.test.sql)', () => {
  const service = { base_amount: 10000, wht_rate: 3, wht_income_type: 'service' }
  it('withhold / pay_once: 10,000 × 3% = 300', () => {
    expect(settlementWht([service], 10700, 10700, 'withhold')).toBe(300)
    expect(settlementWht([service], 10700, 10700, 'pay_once')).toBe(300)
  })
  it('pay_always grosses up: 10,000 × 3 ÷ 97 = 309.28', () => {
    expect(settlementWht([service], 10700, 10700, 'pay_always')).toBe(309.28)
  })
  it('half payment of two income types: 90 + 20', () => {
    const lines = [
      { base_amount: 6000, wht_rate: 3, wht_income_type: 'service' },
      { base_amount: 4000, wht_rate: 1, wht_income_type: 'transport' },
    ]
    expect(settlementWht(lines, 10700, 5350, 'withhold')).toBe(110)
  })
  it('borne tax: paid amount is the full settled amount', () => {
    const allocs = [{ amount: 10700, wht_amount: 309.28 }]
    expect(paidAmount(allocs, 'pay_always')).toBe(10700)
    expect(paidAmount(allocs, 'withhold')).toBe(10390.72)
  })
})
