/**
 * Thai 13-digit tax ID / national ID checksum.
 * Must stay in sync with SQL `public.is_valid_thai_tax_id`.
 */
export function isValidThaiTaxId(value: string): boolean {
  if (!/^\d{13}$/.test(value)) return false
  let sum = 0
  for (let i = 0; i < 12; i++) sum += Number(value[i]) * (13 - i)
  return (11 - (sum % 11)) % 10 === Number(value[12])
}

/** Strip spaces/dashes users often type, e.g. "0-1055-36000-31-3". */
export function normalizeTaxId(value: string): string {
  return value.replace(/[\s-]/g, '')
}
