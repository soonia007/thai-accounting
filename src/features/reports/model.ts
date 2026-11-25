// Report model: every M8 report is turned into one plain table (columns + rows) that the screen,
// the PDF and the Excel export all render — so the three can never disagree.

export type Cell = string | number | null
export type RowKind = 'normal' | 'section' | 'subtotal' | 'total'

export interface ReportColumn {
  key: string
  label: string
  align?: 'left' | 'right'
  /** relative width weight (PDF / Excel) */
  weight?: number
  /** numbers in this column are money (2 decimals, thousands separators) */
  money?: boolean
}
export interface ReportRow {
  kind?: RowKind
  indent?: boolean
  cells: Cell[]
}
export interface ReportTable {
  columns: ReportColumn[]
  rows: ReportRow[]
  /** assets = liabilities + equity, debit = credit … shown as a check mark on screen */
  balanced?: boolean
}

// ---- raw rows returned by the report_* RPCs --------------------------------------------------
export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
interface Named {
  code: string
  type: AccountType
  name_th: string
  name_en: string
}
export interface TbRow extends Named {
  opening: number
  debit: number
  credit: number
  closing: number
}
export interface AmountRow extends Named {
  amount: number
}
export interface BalanceSheetData {
  rows: AmountRow[]
  unclosed_profit: number
}
export interface GlLine {
  date: string
  company_id: string
  ref: string | null
  description: string | null
  contact: string | null
  debit: number
  credit: number
}
export interface GlAccount extends Named {
  opening: number
  lines: GlLine[]
}
export interface ArApRow {
  company_id: string
  contact_id: string | null
  contact: string | null
  tax_id: string | null
  balance: number
}

export interface Lang {
  lang: string
}
const nameOf = (r: Named, lang: string) => (lang === 'en' ? r.name_en : r.name_th)
const r2 = (n: number) => Math.round(n * 100) / 100
const sum = (xs: number[]) => r2(xs.reduce((s, x) => s + x, 0))
const dr = (net: number) => (net > 0 ? r2(net) : 0)
const cr = (net: number) => (net < 0 ? r2(-net) : 0)

// ---- trial balance ---------------------------------------------------------------------------
export interface TbLabels {
  code: string
  account: string
  openingDr: string
  openingCr: string
  periodDr: string
  periodCr: string
  closingDr: string
  closingCr: string
  total: string
}
export function buildTrialBalance(rows: TbRow[], lang: string, L: TbLabels): ReportTable {
  const columns: ReportColumn[] = [
    { key: 'code', label: L.code, weight: 1.1 },
    { key: 'name', label: L.account, weight: 3 },
    ...(
      [
        ['oDr', L.openingDr],
        ['oCr', L.openingCr],
        ['pDr', L.periodDr],
        ['pCr', L.periodCr],
        ['cDr', L.closingDr],
        ['cCr', L.closingCr],
      ] as const
    ).map(([key, label]) => ({
      key,
      label,
      align: 'right' as const,
      weight: 1.5,
      money: true,
    })),
  ]
  const body = rows.map<ReportRow>((r) => ({
    cells: [
      r.code,
      nameOf(r, lang),
      dr(r.opening),
      cr(r.opening),
      r2(r.debit),
      r2(r.credit),
      dr(r.closing),
      cr(r.closing),
    ],
  }))
  const col = (i: number) => sum(body.map((b) => b.cells[i] as number))
  const total: ReportRow = {
    kind: 'total',
    cells: [null, L.total, col(2), col(3), col(4), col(5), col(6), col(7)],
  }
  return {
    columns,
    rows: [...body, total],
    balanced:
      total.cells[2] === total.cells[3] &&
      total.cells[4] === total.cells[5] &&
      total.cells[6] === total.cells[7],
  }
}

// ---- income statement ------------------------------------------------------------------------
export interface IsLabels {
  code: string
  account: string
  amount: string
  revenue: string
  expenses: string
  totalRevenue: string
  totalExpenses: string
  netProfit: string
  netLoss: string
}
export function buildIncomeStatement(rows: AmountRow[], lang: string, L: IsLabels): ReportTable {
  const columns: ReportColumn[] = [
    { key: 'code', label: L.code, weight: 1.2 },
    { key: 'name', label: L.account, weight: 5 },
    { key: 'amount', label: L.amount, align: 'right', weight: 2, money: true },
  ]
  const rev = rows.filter((r) => r.type === 'revenue')
  const exp = rows.filter((r) => r.type === 'expense')
  const totalRev = sum(rev.map((r) => r.amount))
  const totalExp = sum(exp.map((r) => r.amount))
  const net = r2(totalRev - totalExp)
  const line = (r: AmountRow): ReportRow => ({
    indent: true,
    cells: [r.code, nameOf(r, lang), r2(r.amount)],
  })
  return {
    columns,
    rows: [
      { kind: 'section', cells: [null, L.revenue, null] },
      ...rev.map(line),
      { kind: 'subtotal', cells: [null, L.totalRevenue, totalRev] },
      { kind: 'section', cells: [null, L.expenses, null] },
      ...exp.map(line),
      { kind: 'subtotal', cells: [null, L.totalExpenses, totalExp] },
      { kind: 'total', cells: [null, net >= 0 ? L.netProfit : L.netLoss, net] },
    ],
  }
}

// ---- balance sheet ---------------------------------------------------------------------------
export interface BsLabels {
  code: string
  account: string
  amount: string
  assets: string
  liabilities: string
  equity: string
  totalAssets: string
  totalLiabilities: string
  totalEquity: string
  totalLiabilitiesEquity: string
  unclosedProfit: string
}
export function buildBalanceSheet(data: BalanceSheetData, lang: string, L: BsLabels): ReportTable {
  const columns: ReportColumn[] = [
    { key: 'code', label: L.code, weight: 1.2 },
    { key: 'name', label: L.account, weight: 5 },
    { key: 'amount', label: L.amount, align: 'right', weight: 2, money: true },
  ]
  const of = (t: AccountType) => data.rows.filter((r) => r.type === t)
  const assets = of('asset')
  const liabilities = of('liability')
  const equity = of('equity')
  const tA = sum(assets.map((r) => r.amount))
  const tL = sum(liabilities.map((r) => r.amount))
  const tE = r2(sum(equity.map((r) => r.amount)) + data.unclosed_profit)
  const line = (r: AmountRow): ReportRow => ({
    indent: true,
    cells: [r.code, nameOf(r, lang), r2(r.amount)],
  })
  return {
    columns,
    balanced: tA === r2(tL + tE),
    rows: [
      { kind: 'section', cells: [null, L.assets, null] },
      ...assets.map(line),
      { kind: 'subtotal', cells: [null, L.totalAssets, tA] },
      { kind: 'section', cells: [null, L.liabilities, null] },
      ...liabilities.map(line),
      { kind: 'subtotal', cells: [null, L.totalLiabilities, tL] },
      { kind: 'section', cells: [null, L.equity, null] },
      ...equity.map(line),
      { indent: true, cells: [null, L.unclosedProfit, r2(data.unclosed_profit)] },
      { kind: 'subtotal', cells: [null, L.totalEquity, tE] },
      { kind: 'total', cells: [null, L.totalLiabilitiesEquity, r2(tL + tE)] },
    ],
  }
}

// ---- general ledger --------------------------------------------------------------------------
export interface GlLabels {
  date: string
  ref: string
  description: string
  company: string
  debit: string
  credit: string
  balance: string
  openingBalance: string
  periodTotal: string
}
/** Balance in the account's normal direction: assets/expenses grow with debits, the rest with credits. */
const natural = (type: AccountType, net: number) =>
  r2(type === 'asset' || type === 'expense' ? net : -net)

export function buildGeneralLedger(
  accounts: GlAccount[],
  lang: string,
  L: GlLabels,
  company: { show: boolean; name: (id: string) => string },
): ReportTable {
  const columns: ReportColumn[] = [
    { key: 'date', label: L.date, weight: 1.6 },
    { key: 'ref', label: L.ref, weight: 2 },
    { key: 'desc', label: L.description, weight: 4 },
    ...(company.show ? [{ key: 'company', label: L.company, weight: 2 }] : []),
    { key: 'debit', label: L.debit, align: 'right' as const, weight: 1.8, money: true },
    { key: 'credit', label: L.credit, align: 'right' as const, weight: 1.8, money: true },
    { key: 'balance', label: L.balance, align: 'right' as const, weight: 2, money: true },
  ]
  const rows: ReportRow[] = []
  const blanks = (n: number): Cell[] => Array<Cell>(n).fill(null)
  const mid = company.show ? 4 : 3 // date, ref, desc [, company]
  for (const a of accounts) {
    let net = a.opening
    rows.push({
      kind: 'section',
      cells: [`${a.code}  ${nameOf(a, lang)}`, ...blanks(columns.length - 1)],
    })
    rows.push({
      cells: [null, null, L.openingBalance, ...blanks(mid - 3), null, null, natural(a.type, net)],
    })
    let td = 0
    let tc = 0
    for (const l of a.lines) {
      net = r2(net + l.debit - l.credit)
      td += l.debit
      tc += l.credit
      rows.push({
        cells: [
          l.date,
          l.ref,
          [l.description === l.ref ? null : l.description, l.contact].filter(Boolean).join(' · ') ||
            null,
          ...(company.show ? [company.name(l.company_id)] : []),
          l.debit ? r2(l.debit) : null,
          l.credit ? r2(l.credit) : null,
          natural(a.type, net),
        ],
      })
    }
    rows.push({
      kind: 'subtotal',
      cells: [null, null, L.periodTotal, ...blanks(mid - 3), r2(td), r2(tc), natural(a.type, net)],
    })
  }
  return { columns, rows }
}

// ---- receivable / payable --------------------------------------------------------------------
export interface ArApLabels {
  contact: string
  taxId: string
  company: string
  balance: string
  total: string
  unassigned: string
}
export function buildArAp(
  rows: ArApRow[],
  L: ArApLabels,
  company: { show: boolean; name: (id: string) => string },
): ReportTable {
  const columns: ReportColumn[] = [
    { key: 'contact', label: L.contact, weight: 4 },
    { key: 'tax', label: L.taxId, weight: 2 },
    ...(company.show ? [{ key: 'company', label: L.company, weight: 3 }] : []),
    { key: 'balance', label: L.balance, align: 'right' as const, weight: 2, money: true },
  ]
  const body = rows.map<ReportRow>((r) => ({
    cells: [
      r.contact ?? L.unassigned,
      r.tax_id,
      ...(company.show ? [company.name(r.company_id)] : []),
      r2(r.balance),
    ],
  }))
  return {
    columns,
    rows: [
      ...body,
      {
        kind: 'total',
        cells: [L.total, null, ...(company.show ? [null] : []), sum(rows.map((r) => r.balance))],
      },
    ],
  }
}
