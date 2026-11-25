import { focusForField, isAffected } from './focus'

describe('focusForField', () => {
  it('maps line amount fields to the lines they change', () => {
    const f = focusForField('lines.0.unit_price')!
    expect(f).toMatchObject({ field: 'unit_price', line: 1 })
    expect(isAffected(f, ['line'])).toBe(true)
    expect(isAffected(f, ['vat'])).toBe(true)
    expect(isAffected(f, ['total'])).toBe(true)
  })
  it('WHT only affects the tax / settlement lines', () => {
    const f = focusForField('lines.2.wht_rate')!
    expect(f.line).toBe(3)
    expect(isAffected(f, ['wht'])).toBe(true)
    expect(isAffected(f, ['line'])).toBe(false)
  })
  it('dates, references and notes do not affect the books', () => {
    for (const name of ['d-date', 'due_date', 'd-ref-text', 'notes']) {
      expect(focusForField(name)?.sources).toEqual([])
    }
  })
  it('recognises payment allocation inputs and unknown fields', () => {
    expect(focusForField('alloc.1.wht')).toMatchObject({ field: 'alloc_wht', line: 2 })
    expect(focusForField('something-else')).toBeNull()
  })
})
