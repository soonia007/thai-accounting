import type { ReportTable } from '@/features/reports/model'

export interface AssetRow {
  id: string
  code: string
  name: string
  category: string
  category_id: string
  acquired_on: string
  cost: number
  salvage: number
  life_months: number
  monthly: number
  booked: number
  accum: number
  status: 'active' | 'disposed'
  disposed_on: string | null
  disposal_proceeds: number | null
  source: 'document' | 'opening' | 'recorded'
  source_document_id: string | null
  disposal_document_id: string | null
}

const r2 = (n: number) => Math.round(n * 100) / 100
const dim = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()

/** Same arithmetic as SQL private.month_pos: month index + day / days in that month. */
export function monthPos(iso: string): number {
  const y = Number(iso.slice(0, 4))
  const m = Number(iso.slice(5, 7))
  const d = Number(iso.slice(8, 10))
  return y * 12 + m - 1 + d / dim(y, m)
}
const dayBefore = (iso: string) => {
  const t = new Date(`${iso}T00:00:00Z`)
  t.setUTCDate(t.getUTCDate() - 1)
  return t.toISOString().slice(0, 10)
}

/** Depreciation due from the start date through `date` (mirror of SQL private.asset_accum_to). */
export function accumTo(
  a: { acquired_on: string; cost: number; salvage: number; life_months: number },
  date: string,
) {
  if (date < a.acquired_on) return 0
  const base = a.cost - a.salvage
  return Math.min(
    base,
    r2((base / a.life_months) * (monthPos(date) - monthPos(dayBefore(a.acquired_on)))),
  )
}

export interface ScheduleRow {
  month: string // YYYY-MM-01
  amount: number
  accum: number
  nbv: number
}

/** Month-by-month plan from the start month until fully depreciated (max 1200 rows). */
export function schedule(a: {
  acquired_on: string
  cost: number
  salvage: number
  life_months: number
}): ScheduleRow[] {
  const rows: ScheduleRow[] = []
  let y = Number(a.acquired_on.slice(0, 4))
  let m = Number(a.acquired_on.slice(5, 7))
  let prev = 0
  const base = a.cost - a.salvage
  for (let i = 0; i < 1201 && prev < base; i++) {
    const end = `${y}-${String(m).padStart(2, '0')}-${String(dim(y, m)).padStart(2, '0')}`
    const acc = accumTo(a, end)
    rows.push({
      month: `${end.slice(0, 7)}-01`,
      amount: r2(acc - prev),
      accum: acc,
      nbv: r2(a.cost - acc),
    })
    prev = acc
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return rows
}

export interface RegisterLabels {
  code: string
  name: string
  category: string
  acquired: string
  cost: string
  accum: string
  nbv: string
  status: string
  disposed: string
  total: string
}

export function buildRegister(rows: AssetRow[], L: RegisterLabels): ReportTable {
  const nbv = (r: AssetRow) => (r.status === 'disposed' ? 0 : r2(Number(r.cost) - Number(r.accum)))
  const live = rows.filter((r) => r.status === 'active')
  return {
    columns: [
      { key: 'code', label: L.code, weight: 1.4 },
      { key: 'name', label: L.name, weight: 3 },
      { key: 'cat', label: L.category, weight: 2.2 },
      { key: 'date', label: L.acquired, weight: 1.5 },
      { key: 'cost', label: L.cost, align: 'right', weight: 1.8, money: true },
      { key: 'accum', label: L.accum, align: 'right', weight: 1.8, money: true },
      { key: 'nbv', label: L.nbv, align: 'right', weight: 1.8, money: true },
      { key: 'status', label: L.status, weight: 1.4 },
    ],
    rows: [
      ...rows.map((r) => ({
        cells: [
          r.code,
          r.name,
          r.category,
          r.acquired_on,
          r2(Number(r.cost)),
          r2(Number(r.accum)),
          nbv(r),
          r.status === 'disposed' ? L.disposed : null,
        ],
      })),
      {
        kind: 'total' as const,
        cells: [
          null,
          L.total,
          null,
          null,
          r2(live.reduce((s, r) => s + Number(r.cost), 0)),
          r2(live.reduce((s, r) => s + Number(r.accum), 0)),
          r2(live.reduce((s, r) => s + nbv(r), 0)),
          null,
        ],
      },
    ],
  }
}

/** Months still to be depreciated: from the month after the last run (or the first asset's
 *  start month) up to the current month. */
export function pendingMonths(
  lastRun: string | null,
  firstStart: string | null,
  today: string,
): string[] {
  if (!firstStart) return []
  const startY = lastRun ? Number(lastRun.slice(0, 4)) : Number(firstStart.slice(0, 4))
  const startM = lastRun ? Number(lastRun.slice(5, 7)) + 1 : Number(firstStart.slice(5, 7))
  const out: string[] = []
  let y = startY
  let m = startM
  if (m > 12) {
    m = 1
    y += 1
  }
  const ty = Number(today.slice(0, 4))
  const tm = Number(today.slice(5, 7))
  while ((y < ty || (y === ty && m <= tm)) && out.length < 240) {
    out.push(`${y}-${String(m).padStart(2, '0')}-01`)
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return out
}
