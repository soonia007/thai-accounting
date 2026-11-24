/** Thai banks (codes are our own stable ids, stored in bank_accounts.bank_code). */
export const BANKS = [
  { code: 'BBL', th: 'ธนาคารกรุงเทพ', en: 'Bangkok Bank' },
  { code: 'KBANK', th: 'ธนาคารกสิกรไทย', en: 'Kasikornbank' },
  { code: 'KTB', th: 'ธนาคารกรุงไทย', en: 'Krungthai Bank' },
  { code: 'SCB', th: 'ธนาคารไทยพาณิชย์', en: 'Siam Commercial Bank' },
  { code: 'BAY', th: 'ธนาคารกรุงศรีอยุธยา', en: 'Bank of Ayudhya (Krungsri)' },
  { code: 'TTB', th: 'ธนาคารทหารไทยธนชาต', en: 'TMBThanachart Bank' },
  { code: 'GSB', th: 'ธนาคารออมสิน', en: 'Government Savings Bank' },
  { code: 'BAAC', th: 'ธ.ก.ส.', en: 'BAAC' },
  { code: 'GHB', th: 'ธนาคารอาคารสงเคราะห์', en: 'Government Housing Bank' },
  { code: 'UOB', th: 'ธนาคารยูโอบี', en: 'UOB Thailand' },
  { code: 'CIMBT', th: 'ธนาคารซีไอเอ็มบี ไทย', en: 'CIMB Thai' },
  { code: 'KKP', th: 'ธนาคารเกียรตินาคินภัทร', en: 'Kiatnakin Phatra Bank' },
  { code: 'LHB', th: 'ธนาคารแลนด์ แอนด์ เฮ้าส์', en: 'Land and Houses Bank' },
  { code: 'TISCO', th: 'ธนาคารทิสโก้', en: 'TISCO Bank' },
  { code: 'ICBCT', th: 'ธนาคารไอซีบีซี (ไทย)', en: 'ICBC (Thai)' },
  { code: 'IBANK', th: 'ธนาคารอิสลามแห่งประเทศไทย', en: 'Islamic Bank of Thailand' },
  { code: 'OTHER', th: 'อื่นๆ', en: 'Other' },
] as const

export const bankName = (code: string, lang: string) => {
  const b = BANKS.find((x) => x.code === code)
  return b ? (lang === 'en' ? b.en : b.th) : code
}

/**
 * Suggest the next free ledger code after the BANK-mapped account, e.g. 1120 → 1121.
 * Pure helper so it can be unit-tested.
 */
export function suggestLedgerCode(baseCode: string | undefined, usedCodes: Set<string>): string {
  if (!baseCode || !/^\d+$/.test(baseCode)) return ''
  let n = Number(baseCode) + 1
  for (let i = 0; i < 1000; i++, n++) {
    const code = String(n).padStart(baseCode.length, '0')
    if (!usedCodes.has(code)) return code
  }
  return ''
}
