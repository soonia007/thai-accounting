import { planContactImport } from './contact-csv'

const headers = ['code', 'name', 'contact_type', 'tax_id', 'branch_code', 'credit_term_days']

describe('planContactImport', () => {
  it('maps Thai aliases, pads branch codes and strips tax id dashes', () => {
    const plan = planContactImport(
      headers,
      [
        {
          code: '',
          name: 'ร้าน ก',
          contact_type: 'ผู้ขาย',
          tax_id: '0-1055-36000-31-3',
          branch_code: '1',
          credit_term_days: '30',
        },
      ],
      [],
    )
    expect(plan.errors).toEqual([])
    expect(plan.valid[0]).toMatchObject({
      code: null,
      contact_type: 'vendor',
      entity_type: 'juristic',
      tax_id: '0105536000313',
      branch_code: '00001',
      credit_term_days: 30,
      is_active: true,
    })
  })

  it('reports errors with spreadsheet row numbers', () => {
    const plan = planContactImport(
      headers,
      [
        { name: 'ok' },
        { name: '', tax_id: '0105536000314', contact_type: 'x', credit_term_days: '-1' },
      ],
      [],
    )
    expect(plan.valid).toHaveLength(1)
    expect(plan.errors.map((e) => [e.row, e.field, e.code])).toEqual([
      [3, 'name', 'required'],
      [3, 'contact_type', 'invalidValue'],
      [3, 'tax_id', 'taxId'],
      [3, 'credit_term_days', 'creditTerm'],
    ])
  })

  it('flags duplicates within the file and tax ids owned by another contact', () => {
    const plan = planContactImport(
      headers,
      [
        { code: 'A', name: 'one' },
        { code: 'A', name: 'two' },
        { code: 'B', name: 'three', tax_id: '0105536000313' },
        { code: 'C0009', name: 'four', tax_id: '1234567890121' },
      ],
      [
        { code: 'C0001', tax_id: '0105536000313', branch_code: '00000' },
        { code: 'C0009', tax_id: '1234567890121', branch_code: '00000' },
      ],
    )
    expect(plan.errors.map((e) => [e.row, e.code])).toEqual([
      [3, 'duplicateInFile'],
      [4, 'taxIdExists'],
    ])
    // Row with code C0009 updates its own contact, so its tax id is fine
    expect(plan.valid.map((v) => v.code)).toEqual(['A', 'C0009'])
  })

  it('requires the name column', () => {
    expect(planContactImport(['code'], [], []).missingColumns).toEqual(['name'])
  })
})
