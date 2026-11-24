import { calcDocument, calcLine, NegativeLineError } from './calc'

/**
 * Same inputs/outputs as SQL public.calc_line (verified against the DB and in
 * supabase/tests/04_m4_posting_engine.test.sql). If one side changes, both must.
 */
describe('calcLine matches SQL calc_line', () => {
  it.each([
    // qty, price, discount, mode, rate, wht → base, vat, wht
    [1, 1.5, 0, 'exclusive', 7, 3, 1.5, 0.11, 0.05],
    [1, 1070, 0, 'inclusive', 7, 0, 1000, 70, 0],
    [3, 33.333, 0, 'exclusive', 7, 0, 100, 7, 0],
    [2, 500, 100, 'none', 7, 5, 900, 0, 45],
    [3, 333.33, 10, 'exclusive', 7, 3, 989.99, 69.3, 29.7],
    [1, 99.99, 0, 'exclusive', 7, 0, 99.99, 7, 0],
    [1, 0.125, 0, 'inclusive', 7, 0, 0.12, 0.01, 0],
    [2.5, 19.99, 0.01, 'inclusive', 7, 5, 46.7, 3.27, 2.34],
    [1, 100, 0, 'exclusive', 10, 1.5, 100, 10, 1.5],
  ] as const)(
    '%s × %s − %s (%s %s%%, WHT %s%%) → %s / %s / %s',
    (qty, unitPrice, discount, mode, vatRate, whtRate, base, vat, wht) => {
      expect(calcLine({ qty, unitPrice, discount, vatRate, whtRate }, mode)).toEqual({
        base,
        vat,
        wht,
      })
    },
  )

  it('accepts strings with thousand separators', () => {
    expect(calcLine({ qty: '1', unitPrice: '10,000.00', vatRate: '7' }, 'exclusive')).toEqual({
      base: 10000,
      vat: 700,
      wht: 0,
    })
  })

  it('rejects a discount larger than the line', () => {
    expect(() =>
      calcLine({ qty: 1, unitPrice: 10, discount: 20, vatRate: 7 }, 'exclusive'),
    ).toThrow(NegativeLineError)
  })
})

describe('calcDocument', () => {
  it('splits service VAT (deferred on credit documents) from goods VAT', () => {
    const t = calcDocument(
      [
        { qty: 1, unitPrice: 500, vatRate: 7, itemKind: 'service' },
        { qty: 1, unitPrice: 300, vatRate: 7, itemKind: 'product' },
      ],
      'exclusive',
    )
    expect(t).toMatchObject({ subtotal: 800, vatTotal: 56, vatService: 35, total: 856 })
  })

  it('matches the simulate = post fixture in the SQL tests', () => {
    const t = calcDocument(
      [
        { qty: 3, unitPrice: 333.33, discount: 10, vatRate: 7, itemKind: 'service' },
        { qty: 1, unitPrice: 99.99, vatRate: 7, itemKind: 'product' },
      ],
      'exclusive',
    )
    expect(t).toMatchObject({ subtotal: 1089.98, vatTotal: 76.3, total: 1166.28 })
  })

  it('nets withholding tax from the total', () => {
    const t = calcDocument([{ qty: 1, unitPrice: 10000, vatRate: 7, whtRate: 3 }], 'exclusive')
    expect(t).toMatchObject({ total: 10700, whtTotal: 300, netTotal: 10400 })
  })
})
