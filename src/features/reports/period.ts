export type PeriodPreset = 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'thisYear' | 'lastYear'
export const PERIOD_PRESETS: PeriodPreset[] = [
  'thisMonth',
  'lastMonth',
  'thisQuarter',
  'thisYear',
  'lastYear',
]

const iso = (y: number, m: number, d: number) =>
  `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()

/** Date range for a preset, relative to `today` (YYYY-MM-DD, Bangkok). Ranges end at `today` when still running. */
export function periodRange(preset: PeriodPreset, today: string): { from: string; to: string } {
  const y = Number(today.slice(0, 4))
  const m = Number(today.slice(5, 7))
  switch (preset) {
    case 'thisMonth':
      return { from: iso(y, m, 1), to: today }
    case 'lastMonth': {
      const py = m === 1 ? y - 1 : y
      const pm = m === 1 ? 12 : m - 1
      return { from: iso(py, pm, 1), to: iso(py, pm, lastDay(py, pm)) }
    }
    case 'thisQuarter': {
      const qm = Math.floor((m - 1) / 3) * 3 + 1
      return { from: iso(y, qm, 1), to: today }
    }
    case 'thisYear':
      return { from: iso(y, 1, 1), to: today }
    case 'lastYear':
      return { from: iso(y - 1, 1, 1), to: iso(y - 1, 12, 31) }
  }
}

export function matchPreset(from: string, to: string, today: string): PeriodPreset | null {
  return (
    PERIOD_PRESETS.find((p) => {
      const r = periodRange(p, today)
      return r.from === from && r.to === to
    }) ?? null
  )
}
