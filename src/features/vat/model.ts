import type { ReportColumn, ReportRow, ReportTable } from '@/features/reports/model'

/** One row of report_vat_sales / report_vat_purchases */
export interface VatRow {
  date: string
  number: string | null
  our_number?: string | null
  contact: string | null
  tax_id: string | null
  branch: string | null
  base: number
  vat: number
  late?: boolean
  kind: 'document' | 'payment'
  source_id: string
}

export interface VatSummary {
  month: string
  sales_total: number
  zero_rated: number
  exempt: number
  taxable_sales: number
  output_vat: number
  purchase_base: number
  input_vat: number
  carried_in: number
  net: number
  previous_filed: boolean
  has_earlier_filing: boolean
  filing: null | {
    filed_at: string
    excess_choice: 'refund' | 'carry' | null
    net: number
    output_vat: number
    input_vat: number
    carried_in: number
  }
}

export interface VatLabels {
  seq: string
  date: string
  invoiceNo: string
  buyer: string
  seller: string
  taxId: string
  branch: string
  headOffice: string
  branchNo: string
  base: string
  vat: string
  ourDoc: string
  late: string
  total: string
}

const r2 = (n: number) => Math.round(n * 100) / 100
const branchText = (b: string | null, L: VatLabels) =>
  !b ? null : b === '00000' ? L.headOffice : `${L.branchNo} ${b}`

/** Output / input VAT register in the Revenue Department layout (seq, date, invoice, name …). */
export function buildVatRegister(
  rows: VatRow[],
  side: 'sales' | 'purchases',
  L: VatLabels,
): ReportTable {
  const columns: ReportColumn[] = [
    { key: 'seq', label: L.seq, weight: 0.7 },
    { key: 'date', label: L.date, weight: 1.5 },
    { key: 'no', label: L.invoiceNo, weight: 2 },
    { key: 'name', label: side === 'sales' ? L.buyer : L.seller, weight: 3.4 },
    { key: 'tax', label: L.taxId, weight: 2.1 },
    { key: 'branch', label: L.branch, weight: 1.5 },
    ...(side === 'purchases' ? [{ key: 'ours', label: L.ourDoc, weight: 2 }] : []),
    { key: 'base', label: L.base, align: 'right' as const, weight: 1.9, money: true },
    { key: 'vat', label: L.vat, align: 'right' as const, weight: 1.6, money: true },
  ]
  const body = rows.map<ReportRow>((r, i) => ({
    cells: [
      String(i + 1),
      r.date,
      r.number,
      r.contact,
      r.tax_id,
      branchText(r.branch, L),
      ...(side === 'purchases'
        ? [[r.our_number, r.late ? L.late : null].filter(Boolean).join(' · ') || null]
        : []),
      r2(Number(r.base)),
      r2(Number(r.vat)),
    ],
  }))
  const blanks = side === 'purchases' ? 6 : 5
  return {
    columns,
    rows: [
      ...body,
      {
        kind: 'total',
        cells: [
          null,
          L.total,
          ...Array<null>(blanks - 1).fill(null),
          r2(rows.reduce((s, r) => s + Number(r.base), 0)),
          r2(rows.reduce((s, r) => s + Number(r.vat), 0)),
        ],
      },
    ],
  }
}

export interface Pp30Labels {
  item: string
  amount: string
  l1: string
  l2: string
  l3: string
  l4: string
  l5: string
  l6: string
  l7: string
  l8: string
  l9: string
  l10: string
  l11: string
  l12: string
}

/** PP.30 lines 1–12 (draft to help filing). */
export function buildPp30(s: VatSummary, L: Pp30Labels): ReportTable {
  const out = Number(s.output_vat)
  const inp = Number(s.input_vat)
  const net = Number(s.net)
  const line = (no: number, label: string, v: number, kind?: ReportRow['kind']): ReportRow => ({
    kind,
    cells: [String(no), label, r2(v)],
  })
  return {
    columns: [
      { key: 'no', label: '#', weight: 0.5 },
      { key: 'item', label: L.item, weight: 6 },
      { key: 'amount', label: L.amount, align: 'right', weight: 2, money: true },
    ],
    rows: [
      line(1, L.l1, Number(s.sales_total)),
      line(2, L.l2, Number(s.zero_rated)),
      line(3, L.l3, Number(s.exempt)),
      line(4, L.l4, Number(s.taxable_sales), 'subtotal'),
      line(5, L.l5, out),
      line(6, L.l6, Number(s.purchase_base)),
      line(7, L.l7, inp),
      line(8, L.l8, Math.max(out - inp, 0)),
      line(9, L.l9, Math.max(inp - out, 0)),
      line(10, L.l10, Number(s.carried_in)),
      line(11, L.l11, Math.max(net, 0), 'total'),
      line(12, L.l12, Math.max(-net, 0), 'total'),
    ],
  }
}

/** The filed snapshot no longer matches the books (something was posted/voided afterwards). */
export const filingOutdated = (s: VatSummary) =>
  !!s.filing &&
  (r2(Number(s.filing.output_vat)) !== r2(Number(s.output_vat)) ||
    r2(Number(s.filing.input_vat)) !== r2(Number(s.input_vat)))
