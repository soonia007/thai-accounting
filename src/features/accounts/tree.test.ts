import { buildTree, descendantIds, filterTree, flattenTree, type Account } from './tree'

function acc(
  id: string,
  code: string,
  parent: string | null,
  extra: Partial<Account> = {},
): Account {
  return {
    id,
    code,
    parent_id: parent,
    name_th: `บัญชี ${code}`,
    name_en: `Account ${code}`,
    type: 'asset',
    is_group: false,
    is_active: true,
    is_system: false,
    company_id: 'c',
    created_at: '',
    updated_at: '',
    ...extra,
  }
}

const accounts = [
  acc('a', '1000', null, { is_group: true }),
  acc('b', '1100', 'a', { is_group: true }),
  acc('d', '1120', 'b', { name_th: 'เงินฝากธนาคาร' }),
  acc('c', '1110', 'b', { name_th: 'เงินสด' }),
  acc('e', '1200', 'a', { is_group: true, is_active: false }),
  acc('f', '2000', null, { is_group: true, type: 'liability' }),
]

const codes = (rows: { account: Account }[]) => rows.map((r) => r.account.code)

describe('buildTree + flattenTree', () => {
  it('nests and sorts by code', () => {
    const rows = flattenTree(buildTree(accounts), new Set())
    expect(codes(rows)).toEqual(['1000', '1100', '1110', '1120', '1200', '2000'])
    expect(rows.map((r) => r.depth)).toEqual([0, 1, 2, 2, 1, 0])
    expect(rows[1].hasChildren).toBe(true)
    expect(rows[2].hasChildren).toBe(false)
  })

  it('sorts codes numerically', () => {
    const rows = flattenTree(buildTree([acc('x', '10', null), acc('y', '9', null)]), new Set())
    expect(codes(rows)).toEqual(['9', '10'])
  })

  it('skips children of collapsed nodes', () => {
    const rows = flattenTree(buildTree(accounts), new Set(['b']))
    expect(codes(rows)).toEqual(['1000', '1100', '1200', '2000'])
  })

  it('treats orphans as roots', () => {
    const rows = flattenTree(buildTree([acc('z', '9999', 'missing')]), new Set())
    expect(codes(rows)).toEqual(['9999'])
  })
})

describe('filterTree', () => {
  const tree = buildTree(accounts)

  it('hides inactive accounts unless requested', () => {
    expect(codes(flattenTree(filterTree(tree, '', false), new Set()))).not.toContain('1200')
    expect(codes(flattenTree(filterTree(tree, '', true), new Set()))).toContain('1200')
  })

  it('keeps ancestors of matches (Thai name search)', () => {
    const rows = flattenTree(filterTree(tree, 'เงินสด', false), new Set())
    expect(codes(rows)).toEqual(['1000', '1100', '1110'])
  })

  it('matches code and English name, case-insensitive', () => {
    expect(codes(flattenTree(filterTree(tree, '112', false), new Set()))).toContain('1120')
    expect(codes(flattenTree(filterTree(tree, 'ACCOUNT 2000', false), new Set()))).toEqual(['2000'])
  })
})

describe('descendantIds', () => {
  it('includes the node and all descendants', () => {
    expect([...descendantIds(accounts, 'b')].sort()).toEqual(['b', 'c', 'd'])
    expect(descendantIds(accounts, 'f')).toEqual(new Set(['f']))
  })
})
