import type { ReportRow, ReportTable } from '@/features/reports/model'

export interface BalanceRow {
  product_id: string
  code: string
  name: string
  unit: string | null
  qty: number
  value: number
  reorder_level: number | null
  low: boolean
}
export interface CardLine {
  date: string
  kind: 'opening' | 'purchase' | 'sale' | 'return' | 'adjust' | 'void'
  ref: string | null
  contact: string | null
  qty: number
  amount: number
}
export interface StockCard {
  product: { id: string; code: string; name: string; unit: string | null }
  opening_qty: number
  opening_value: number
  lines: CardLine[]
}

const r2 = (n: number) => Math.round(n * 100) / 100
const q4 = (n: number) => Math.round(n * 10000) / 10000
const qty = (n: number) => String(q4(n))

export interface BalanceLabels {
  code: string
  name: string
  unit: string
  qty: string
  avgCost: string
  value: string
  reorder: string
  status: string
  low: string
  total: string
}

export function buildStockBalance(rows: BalanceRow[], L: BalanceLabels): ReportTable {
  return {
    columns: [
      { key: 'code', label: L.code, weight: 1.2 },
      { key: 'name', label: L.name, weight: 3.5 },
      { key: 'unit', label: L.unit, weight: 1 },
      { key: 'qty', label: L.qty, align: 'right', weight: 1.4 },
      { key: 'avg', label: L.avgCost, align: 'right', weight: 1.6, money: true },
      { key: 'value', label: L.value, align: 'right', weight: 2, money: true },
      { key: 'reorder', label: L.reorder, align: 'right', weight: 1.4 },
      { key: 'status', label: L.status, weight: 1.4 },
    ],
    rows: [
      ...rows.map<ReportRow>((r) => ({
        cells: [
          r.code,
          r.name,
          r.unit,
          qty(Number(r.qty)),
          Number(r.qty) > 0 ? r2(Number(r.value) / Number(r.qty)) : null,
          r2(Number(r.value)),
          r.reorder_level === null ? null : qty(Number(r.reorder_level)),
          r.low ? L.low : null,
        ],
      })),
      {
        kind: 'total',
        cells: [
          null,
          L.total,
          null,
          null,
          null,
          r2(rows.reduce((s, r) => s + Number(r.value), 0)),
          null,
          null,
        ],
      },
    ],
  }
}

export interface CardLabels {
  date: string
  ref: string
  detail: string
  inQty: string
  outQty: string
  balQty: string
  inValue: string
  outValue: string
  balValue: string
  opening: string
  closing: string
  kinds: Record<CardLine['kind'], string>
}

/** Stock card in the Revenue Department layout: in / out / balance, quantity and value. */
export function buildStockCard(card: StockCard, L: CardLabels): ReportTable {
  let q = Number(card.opening_qty)
  let v = Number(card.opening_value)
  const rows: ReportRow[] = [
    { kind: 'subtotal', cells: [null, null, L.opening, null, null, qty(q), null, null, r2(v)] },
  ]
  let tin = 0
  let tout = 0
  let vin = 0
  let vout = 0
  for (const l of card.lines) {
    const n = Number(l.qty)
    const a = Number(l.amount)
    q = q4(q + n)
    v = r2(v + a)
    if (n > 0) {
      tin += n
      vin += a
    } else {
      tout -= n
      vout -= a
    }
    rows.push({
      cells: [
        l.date,
        l.ref,
        [L.kinds[l.kind], l.contact].filter(Boolean).join(' · '),
        n > 0 ? qty(n) : null,
        n < 0 ? qty(-n) : null,
        qty(q),
        n > 0 ? r2(a) : null,
        n < 0 ? r2(-a) : null,
        r2(v),
      ],
    })
  }
  rows.push({
    kind: 'total',
    cells: [null, null, L.closing, qty(tin), qty(tout), qty(q), r2(vin), r2(vout), r2(v)],
  })
  return {
    columns: [
      { key: 'date', label: L.date, weight: 1.4 },
      { key: 'ref', label: L.ref, weight: 1.8 },
      { key: 'detail', label: L.detail, weight: 2.8 },
      { key: 'inq', label: L.inQty, align: 'right', weight: 1 },
      { key: 'outq', label: L.outQty, align: 'right', weight: 1 },
      { key: 'balq', label: L.balQty, align: 'right', weight: 1 },
      { key: 'inv', label: L.inValue, align: 'right', weight: 1.6, money: true },
      { key: 'outv', label: L.outValue, align: 'right', weight: 1.6, money: true },
      { key: 'balv', label: L.balValue, align: 'right', weight: 1.7, money: true },
    ],
    rows,
  }
}
