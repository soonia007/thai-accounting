import { companySchema } from './company-schema'

const base = {
  name: 'บริษัท ทดสอบ จำกัด',
  taxId: '',
  isHeadOffice: true,
  branchCode: '',
  address: '',
  vatRegistered: false,
}

const issues = (input: object) =>
  companySchema.safeParse({ ...base, ...input }).error?.issues.map((i) => i.message) ?? []

describe('companySchema', () => {
  it('accepts a minimal non-VAT head office', () => {
    expect(issues({})).toEqual([])
  })

  it('normalizes tax id with dashes', () => {
    const r = companySchema.parse({ ...base, taxId: '0-1055-36000-31-3' })
    expect(r.taxId).toBe('0105536000313')
  })

  it('rejects an invalid tax id', () => {
    expect(issues({ taxId: '0105536000314' })).toContain('taxId')
  })

  it('requires a tax id when VAT registered', () => {
    expect(issues({ vatRegistered: true })).toContain('taxIdRequired')
    expect(issues({ vatRegistered: true, taxId: '0105536000313' })).toEqual([])
  })

  it('requires a 5-digit branch number for branches', () => {
    expect(issues({ isHeadOffice: false, branchCode: '12' })).toContain('branchCode')
    expect(issues({ isHeadOffice: false, branchCode: '00001' })).toEqual([])
  })

  it('requires a name', () => {
    expect(issues({ name: '  ' })).toContain('required')
  })
})
