import { defaultWht, paymentAmount, totalWht } from './payment-math'

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
