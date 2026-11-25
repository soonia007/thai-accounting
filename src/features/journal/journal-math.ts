/** Form helpers for the general journal (pure, unit-tested). Amounts in baht, 2 decimals. */

export interface JournalLineForm {
  account_id: string
  description: string
  debit: string
  credit: string
}

export const emptyJournalLine = (): JournalLineForm => ({
  account_id: '',
  description: '',
  debit: '',
  credit: '',
})

/** "1,234.5" → 123450 (satang); blank / invalid → 0 */
export function toSatang(v: string): number {
  const s = v.replace(/,/g, '').trim()
  if (s === '') return 0
  const n = Number(s)
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

export interface JournalBalance {
  debit: number
  credit: number
  /** debit − credit (baht) */
  difference: number
  balanced: boolean
  /** lines that carry an amount */
  used: number
}

/** Totals for the live balance bar — integer satang so 0.1 + 0.2 never drifts. */
export function journalBalance(lines: JournalLineForm[]): JournalBalance {
  let dr = 0
  let cr = 0
  let used = 0
  for (const l of lines) {
    const d = toSatang(l.debit)
    const c = toSatang(l.credit)
    dr += d
    cr += c
    if (d !== 0 || c !== 0) used += 1
  }
  return {
    debit: dr / 100,
    credit: cr / 100,
    difference: (dr - cr) / 100,
    balanced: dr === cr && dr > 0 && used >= 2,
    used,
  }
}

/** Payload for save / simulate (blank rows are dropped server-side too). */
export function journalPayload(
  companyId: string,
  form: { entry_date: string; memo: string; reference: string; lines: JournalLineForm[] },
  id?: string,
) {
  return {
    ...(id ? { id } : {}),
    company_id: companyId,
    entry_date: form.entry_date,
    memo: form.memo,
    reference: form.reference,
    lines: form.lines.map((l) => ({
      account_id: l.account_id || null,
      description: l.description,
      debit: toSatang(l.debit) / 100,
      credit: toSatang(l.credit) / 100,
    })),
  }
}
