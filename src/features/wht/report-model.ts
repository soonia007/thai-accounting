import type { ReportColumn, ReportRow, ReportTable } from '@/features/reports/model'

export type WhtConditionCode = 'withhold' | 'pay_always' | 'pay_once'

/** report_wht_pnd row: one certificate line */
export interface PndLine {
  cert_id: string
  cert_number: string
  date: string
  contact: string
  tax_id: string | null
  branch: string | null
  address: string | null
  income_type: string
  income_name_th: string
  income_name_en: string
  section: string
  rate: number
  income: number
  tax: number
  condition: WhtConditionCode
}
export interface IssuedCert {
  id: string
  number: string
  date: string
  form: 'pnd3' | 'pnd53'
  contact: string
  tax_id: string | null
  income: number
  tax: number
  voided: boolean
}
export interface ReceivedWht {
  kind: 'document' | 'payment'
  source_id: string
  date: string
  number: string
  contact: string | null
  tax_id: string | null
  income: number
  tax: number
  cert_no: string | null
  cert_date: string | null
}

const r2 = (n: number) => Math.round(n * 100) / 100
const sum = (xs: number[]) => r2(xs.reduce((s, x) => s + Number(x), 0))
/** PND "เงื่อนไข": 1 withheld, 2 paid by us every time, 3 paid by us once */
export const conditionCode = (c: WhtConditionCode) =>
  c === 'withhold' ? '1' : c === 'pay_always' ? '2' : '3'

export interface PndLabels {
  seq: string
  taxId: string
  payee: string
  branch: string
  headOffice: string
  date: string
  incomeType: string
  rate: string
  income: string
  tax: string
  condition: string
  total: string
  payees: string
  lines: string
}

/** Summary by income type (rows) + payee count, for the PND.3 / PND.53 cover. */
export function buildPndSummary(lines: PndLine[], lang: string, L: PndLabels): ReportTable {
  const groups = new Map<string, { label: string; income: number; tax: number; n: number }>()
  for (const l of lines) {
    const key = l.income_type
    const g = groups.get(key) ?? {
      label: `${lang === 'en' ? l.income_name_en : l.income_name_th} ${l.section}`,
      income: 0,
      tax: 0,
      n: 0,
    }
    g.income += Number(l.income)
    g.tax += Number(l.tax)
    g.n += 1
    groups.set(key, g)
  }
  const payees = new Set(lines.map((l) => l.tax_id ?? l.contact)).size
  return {
    columns: [
      { key: 'type', label: L.incomeType, weight: 5 },
      { key: 'n', label: L.lines, align: 'right', weight: 1.2 },
      { key: 'income', label: L.income, align: 'right', weight: 2, money: true },
      { key: 'tax', label: L.tax, align: 'right', weight: 2, money: true },
    ],
    rows: [
      ...[...groups.values()].map<ReportRow>((g) => ({
        cells: [g.label, String(g.n), r2(g.income), r2(g.tax)],
      })),
      {
        kind: 'total',
        cells: [
          `${L.total} (${L.payees} ${payees})`,
          String(lines.length),
          sum(lines.map((l) => l.income)),
          sum(lines.map((l) => l.tax)),
        ],
      },
    ],
  }
}

/** The attachment (ใบแนบ): one row per payment line, in the order of the form. */
export function buildPndAttachment(
  lines: PndLine[],
  form: 'pnd3' | 'pnd53',
  lang: string,
  L: PndLabels,
): ReportTable {
  const columns: ReportColumn[] = [
    { key: 'seq', label: L.seq, weight: 0.6 },
    { key: 'tax', label: L.taxId, weight: 2.1 },
    { key: 'payee', label: L.payee, weight: 3 },
    ...(form === 'pnd53' ? [{ key: 'branch', label: L.branch, weight: 1.4 }] : []),
    { key: 'date', label: L.date, weight: 1.5 },
    { key: 'type', label: L.incomeType, weight: 2.6 },
    { key: 'rate', label: L.rate, align: 'right' as const, weight: 0.8 },
    { key: 'income', label: L.income, align: 'right' as const, weight: 1.8, money: true },
    { key: 'whtax', label: L.tax, align: 'right' as const, weight: 1.6, money: true },
    { key: 'cond', label: L.condition, align: 'right' as const, weight: 0.9 },
  ]
  const body = lines.map<ReportRow>((l, i) => ({
    cells: [
      String(i + 1),
      l.tax_id,
      l.contact,
      ...(form === 'pnd53'
        ? [!l.branch ? null : l.branch === '00000' ? L.headOffice : l.branch]
        : []),
      l.date,
      `${lang === 'en' ? l.income_name_en : l.income_name_th} ${l.section}`,
      `${Number(l.rate)}%`,
      r2(Number(l.income)),
      r2(Number(l.tax)),
      conditionCode(l.condition),
    ],
  }))
  const lead = form === 'pnd53' ? 7 : 6
  return {
    columns,
    rows: [
      ...body,
      {
        kind: 'total',
        cells: [
          null,
          null,
          L.total,
          ...Array<null>(lead - 3).fill(null),
          sum(lines.map((l) => l.income)),
          sum(lines.map((l) => l.tax)),
          null,
        ],
      },
    ],
  }
}

export interface RegisterLabels {
  seq: string
  number: string
  date: string
  payee: string
  payer: string
  taxId: string
  form: string
  pnd3: string
  pnd53: string
  income: string
  tax: string
  status: string
  voided: string
  ourDoc: string
  certNo: string
  certDate: string
  missing: string
  total: string
}

/** Issued 50 ทวิ register; voided certificates are listed but not totalled. */
export function buildIssuedRegister(certs: IssuedCert[], L: RegisterLabels): ReportTable {
  const live = certs.filter((c) => !c.voided)
  return {
    columns: [
      { key: 'seq', label: L.seq, weight: 0.6 },
      { key: 'no', label: L.number, weight: 2 },
      { key: 'date', label: L.date, weight: 1.5 },
      { key: 'payee', label: L.payee, weight: 3 },
      { key: 'tax', label: L.taxId, weight: 2.1 },
      { key: 'form', label: L.form, weight: 1.2 },
      { key: 'income', label: L.income, align: 'right', weight: 1.8, money: true },
      { key: 'whtax', label: L.tax, align: 'right', weight: 1.6, money: true },
      { key: 'status', label: L.status, weight: 1.2 },
    ],
    rows: [
      ...certs.map<ReportRow>((c, i) => ({
        cells: [
          String(i + 1),
          c.number,
          c.date,
          c.contact,
          c.tax_id,
          L[c.form],
          r2(Number(c.income)),
          r2(Number(c.tax)),
          c.voided ? L.voided : null,
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
          null,
          sum(live.map((c) => c.income)),
          sum(live.map((c) => c.tax)),
          null,
        ],
      },
    ],
  }
}

/** Tax withheld from us (credit against our income tax) with the customer's certificate. */
export function buildReceivedRegister(rows: ReceivedWht[], L: RegisterLabels): ReportTable {
  return {
    columns: [
      { key: 'seq', label: L.seq, weight: 0.6 },
      { key: 'date', label: L.date, weight: 1.5 },
      { key: 'ours', label: L.ourDoc, weight: 2 },
      { key: 'payer', label: L.payer, weight: 3 },
      { key: 'tax', label: L.taxId, weight: 2.1 },
      { key: 'income', label: L.income, align: 'right', weight: 1.8, money: true },
      { key: 'whtax', label: L.tax, align: 'right', weight: 1.6, money: true },
      { key: 'cert', label: L.certNo, weight: 1.8 },
      { key: 'certDate', label: L.certDate, weight: 1.5 },
    ],
    rows: [
      ...rows.map<ReportRow>((r, i) => ({
        cells: [
          String(i + 1),
          r.date,
          r.number,
          r.contact,
          r.tax_id,
          r2(Number(r.income)),
          r2(Number(r.tax)),
          r.cert_no ?? L.missing,
          r.cert_date,
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
          sum(rows.map((r) => r.income)),
          sum(rows.map((r) => r.tax)),
          null,
          null,
        ],
      },
    ],
  }
}
