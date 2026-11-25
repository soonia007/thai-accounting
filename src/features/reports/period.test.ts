import { describe, expect, it } from 'vitest'
import { matchPreset, periodRange } from './period'

describe('periodRange', () => {
  it('this month / quarter / year run up to today', () => {
    expect(periodRange('thisMonth', '2026-11-25')).toEqual({ from: '2026-11-01', to: '2026-11-25' })
    expect(periodRange('thisQuarter', '2026-11-25')).toEqual({
      from: '2026-10-01',
      to: '2026-11-25',
    })
    expect(periodRange('thisYear', '2026-11-25')).toEqual({ from: '2026-01-01', to: '2026-11-25' })
  })
  it('last month handles January and leap February', () => {
    expect(periodRange('lastMonth', '2026-01-10')).toEqual({ from: '2025-12-01', to: '2025-12-31' })
    expect(periodRange('lastMonth', '2028-03-05')).toEqual({ from: '2028-02-01', to: '2028-02-29' })
  })
  it('last year is the whole calendar year', () => {
    expect(periodRange('lastYear', '2026-11-25')).toEqual({ from: '2025-01-01', to: '2025-12-31' })
  })
  it('matchPreset recognises a preset range and returns null for a custom one', () => {
    expect(matchPreset('2026-01-01', '2026-11-25', '2026-11-25')).toBe('thisYear')
    expect(matchPreset('2026-02-01', '2026-11-25', '2026-11-25')).toBeNull()
  })
})
