import { describe, expect, it } from 'vitest'
import { claimMonthOf, monthLabel, previousMonth, shiftMonth } from './month'

describe('VAT months', () => {
  it('labels months in BE / CE', () => {
    expect(monthLabel('2026-11-01', 'BE', 'th')).toBe('พ.ย. 2569')
    expect(monthLabel('2026-01', 'CE', 'en')).toBe('Jan 2026')
  })
  it('claim month defaults to the tax invoice month', () => {
    expect(claimMonthOf(null, '2026-10-25')).toBe('2026-10-01')
    expect(claimMonthOf('2026-12-01', '2026-10-25')).toBe('2026-12-01')
  })
  it('moves across years', () => {
    expect(previousMonth('2026-01-15')).toBe('2025-12-01')
    expect(shiftMonth('2026-12-01', 1)).toBe('2027-01-01')
    expect(shiftMonth('2026-01-01', -1)).toBe('2025-12-01')
  })
})
