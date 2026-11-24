import { parseBool, parseCsv, parseMoney, toCsv } from './csv'

describe('toCsv / parseCsv', () => {
  it('round-trips Thai text, commas, quotes and newlines', () => {
    const rows = [
      { code: 'C0001', name: 'บริษัท ก, จำกัด', note: 'say "hi"\nline 2' },
      { code: 'C0002', name: null, note: undefined },
    ]
    const csv = toCsv(['code', 'name', 'note'], rows)
    expect(csv.charCodeAt(0) === 0xfeff).toBe(true)
    const parsed = parseCsv(csv)
    expect(parsed.headers).toEqual(['code', 'name', 'note'])
    expect(parsed.rows[0]).toEqual({
      code: 'C0001',
      name: 'บริษัท ก, จำกัด',
      note: 'say "hi"\nline 2',
    })
    expect(parsed.rows[1]).toEqual({ code: 'C0002', name: '', note: '' })
  })

  it('normalizes headers and trims values, skipping blank lines', () => {
    const parsed = parseCsv(' Code , NAME \n  x ,  y  \n\n,\n')
    expect(parsed.headers).toEqual(['code', 'name'])
    expect(parsed.rows).toEqual([{ code: 'x', name: 'y' }])
  })
})

describe('parseBool', () => {
  it.each([
    ['', true, true],
    [undefined, false, false],
    ['TRUE', true, true],
    ['ใช่', false, true],
    ['0', true, false],
    ['ปิด', true, false],
    ['maybe', true, null],
  ])('%s → %s', (v, fallback, expected) => {
    expect(parseBool(v as string | undefined, fallback as boolean)).toBe(expected)
  })
})

describe('parseMoney', () => {
  it('parses thousands separators and rounds to 2 dp', () => {
    expect(parseMoney('1,234.555')).toBe(1234.56)
    expect(parseMoney('')).toBeNull()
    expect(parseMoney('abc')).toBeNaN()
  })
})
