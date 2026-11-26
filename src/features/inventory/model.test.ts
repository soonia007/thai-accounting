import { describe, expect, it } from 'vitest'
import { buildStockBalance, buildStockCard } from './model'

const L = new Proxy(
  {},
  { get: (_t, k) => (k === 'kinds' ? new Proxy({}, { get: (_x, j) => String(j) }) : String(k)) },
) as never

describe('stock card', () => {
  // the FIFO story of supabase/tests/14_m13_inventory.test.sql
  const card = {
    product: { id: 'a', code: 'A', name: 'Widget', unit: 'pc' },
    opening_qty: 0,
    opening_value: 0,
    lines: [
      {
        date: '2026-11-01',
        kind: 'opening' as const,
        ref: 'ADJ-1',
        contact: null,
        qty: 10,
        amount: 1000,
      },
      {
        date: '2026-11-02',
        kind: 'purchase' as const,
        ref: 'EXP-1',
        contact: 'Vend',
        qty: 10,
        amount: 1200,
      },
      {
        date: '2026-11-03',
        kind: 'sale' as const,
        ref: 'INV-1',
        contact: 'Cust',
        qty: -15,
        amount: -1600,
      },
      {
        date: '2026-11-04',
        kind: 'return' as const,
        ref: 'CN-1',
        contact: 'Cust',
        qty: 3,
        amount: 320,
      },
      {
        date: '2026-11-05',
        kind: 'adjust' as const,
        ref: 'ADJ-2',
        contact: null,
        qty: -1,
        amount: -120,
      },
    ],
  }
  it('runs quantity and value balances line by line', () => {
    const t = buildStockCard(card, L)
    expect(t.rows[3].cells).toEqual([
      '2026-11-03',
      'INV-1',
      'sale · Cust',
      null,
      '15',
      '5',
      null,
      1600,
      600,
    ])
    const last = t.rows[t.rows.length - 1]
    expect(last.kind).toBe('total')
    expect(last.cells).toEqual([null, null, 'closing', '23', '16', '7', 2520, 1720, 800])
  })
})

describe('stock balance', () => {
  it('shows average cost, flags low stock and totals the value', () => {
    const t = buildStockBalance(
      [
        {
          product_id: 'a',
          code: 'A',
          name: 'Widget',
          unit: 'pc',
          qty: 7,
          value: 800,
          reorder_level: 8,
          low: true,
        },
        {
          product_id: 'b',
          code: 'B',
          name: 'Bolt',
          unit: null,
          qty: 0,
          value: 0,
          reorder_level: null,
          low: false,
        },
      ],
      L,
    )
    expect(t.rows[0].cells).toEqual(['A', 'Widget', 'pc', '7', 114.29, 800, '8', 'low'])
    expect(t.rows[1].cells[4]).toBeNull()
    expect(t.rows[2].cells[5]).toBe(800)
  })
})
