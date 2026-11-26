import { describe, expect, it } from 'vitest'
import { accumTo, pendingMonths, schedule } from './model'

// the laptop of supabase/tests/15_m14_fixed_assets.test.sql
const laptop = { acquired_on: '2026-03-16', cost: 36000, salvage: 0, life_months: 36 }

describe('straight-line, first month by days (D17)', () => {
  it('matches the SQL arithmetic', () => {
    expect(accumTo(laptop, '2026-03-31')).toBe(516.13)
    expect(accumTo(laptop, '2026-04-30')).toBe(1516.13)
    expect(accumTo(laptop, '2026-07-15')).toBe(4000)
    expect(accumTo(laptop, '2026-03-15')).toBe(0)
  })
  it('plans every month until fully depreciated, ending exactly at cost − salvage', () => {
    const s = schedule(laptop)
    expect(s[0]).toEqual({ month: '2026-03-01', amount: 516.13, accum: 516.13, nbv: 35483.87 })
    expect(s[1].amount).toBe(1000)
    expect(s.length).toBe(37) // 16/31 + 35 full months + the remaining 15/31 in March 2029
    expect(s[s.length - 1].accum).toBe(36000)
    expect(s.reduce((a, r) => a + r.amount, 0)).toBeCloseTo(36000, 2)
  })
  it('a salvage value is never depreciated', () => {
    const s = schedule({ acquired_on: '2026-01-01', cost: 1200, salvage: 200, life_months: 10 })
    expect(s).toHaveLength(10)
    expect(s[9]).toMatchObject({ accum: 1000, nbv: 200 })
  })
})

describe('pending months', () => {
  it('runs from the month after the last run to this month', () => {
    expect(pendingMonths('2026-06-01', '2024-01-01', '2026-08-20')).toEqual([
      '2026-07-01',
      '2026-08-01',
    ])
    expect(pendingMonths(null, '2026-11-16', '2026-11-26')).toEqual(['2026-11-01'])
    expect(pendingMonths('2026-12-01', '2026-01-01', '2027-01-05')).toEqual(['2027-01-01'])
    expect(pendingMonths(null, null, '2026-11-26')).toEqual([])
  })
})
