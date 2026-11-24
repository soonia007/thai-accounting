import type { Tables } from '@/lib/supabase'

export type Account = Tables<'accounts'>

export interface AccountNode {
  account: Account
  children: AccountNode[]
}

export interface VisibleRow {
  account: Account
  depth: number
  hasChildren: boolean
}

const byCode = (a: AccountNode, b: AccountNode) =>
  a.account.code.localeCompare(b.account.code, undefined, { numeric: true })

/** Build a forest from a flat account list. Orphans (parent missing) become roots. */
export function buildTree(accounts: Account[]): AccountNode[] {
  const nodes = new Map<string, AccountNode>()
  for (const account of accounts) nodes.set(account.id, { account, children: [] })

  const roots: AccountNode[] = []
  for (const node of nodes.values()) {
    const parent = node.account.parent_id ? nodes.get(node.account.parent_id) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  const sort = (list: AccountNode[]) => {
    list.sort(byCode)
    list.forEach((n) => sort(n.children))
  }
  sort(roots)
  return roots
}

export function matchesQuery(account: Account, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [account.code, account.name_th, account.name_en ?? ''].some((v) =>
    v.toLowerCase().includes(q),
  )
}

/**
 * Keep nodes that match (or have a matching descendant). Ancestors of matches are kept so the
 * tree stays readable. Inactive accounts are dropped unless `showInactive`.
 */
export function filterTree(
  roots: AccountNode[],
  query: string,
  showInactive: boolean,
): AccountNode[] {
  const visit = (node: AccountNode): AccountNode | null => {
    if (!showInactive && !node.account.is_active) return null
    const children = node.children.map(visit).filter((n): n is AccountNode => n !== null)
    if (matchesQuery(node.account, query) || children.length > 0) return { ...node, children }
    return null
  }
  return roots.map(visit).filter((n): n is AccountNode => n !== null)
}

/** Depth-first rows to render; children of collapsed nodes are skipped. */
export function flattenTree(roots: AccountNode[], collapsed: ReadonlySet<string>): VisibleRow[] {
  const rows: VisibleRow[] = []
  const walk = (nodes: AccountNode[], depth: number) => {
    for (const node of nodes) {
      rows.push({ account: node.account, depth, hasChildren: node.children.length > 0 })
      if (!collapsed.has(node.account.id)) walk(node.children, depth + 1)
    }
  }
  walk(roots, 0)
  return rows
}

/** Ids of `id` and all its descendants — used to stop picking a descendant as the new parent. */
export function descendantIds(accounts: Account[], id: string): Set<string> {
  const result = new Set<string>([id])
  let grew = true
  while (grew) {
    grew = false
    for (const a of accounts) {
      if (a.parent_id && result.has(a.parent_id) && !result.has(a.id)) {
        result.add(a.id)
        grew = true
      }
    }
  }
  return result
}
