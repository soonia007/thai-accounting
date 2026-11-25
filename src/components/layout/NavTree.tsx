import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { NAV_TREE, type NavGroup, type NavLeaf } from './nav-items'

const STORE = 'finora.nav.open'

function readOpen(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? '{}') as Record<string, boolean>
  } catch {
    return {}
  }
}

/** Is `leaf` the page being shown? Leaves with ?tab= compare the tab too (default per list page). */
function leafActive(leaf: NavLeaf, pathname: string, search: string): boolean {
  if (!leaf.to) return false
  const [path, query] = leaf.to.split('?')
  if (query) {
    if (pathname !== path) return false
    const want = new URLSearchParams(query).get('tab')
    const have = new URLSearchParams(search).get('tab') ?? (path === '/sales' ? 'invoice' : 'bill')
    return want === have
  }
  return leaf.exact ? pathname === path : pathname === path || pathname.startsWith(`${path}/`)
}

function groupContains(group: NavGroup, pathname: string): boolean {
  return group.items.some((i) => {
    if (!i.to) return false
    const path = i.to.split('?')[0]
    return i.exact ? pathname === path : pathname === path || pathname.startsWith(`${path}/`)
  })
}

const row = 'flex h-9 w-full items-center gap-2.5 rounded-xl px-3 text-sm transition-colors'

/**
 * The whole product as collapsible categories. Anything not built yet is listed greyed out
 * with the milestone (M#) that delivers it, so the roadmap is visible in the app itself.
 */
export function NavTree({
  className,
  onNavigate,
}: {
  className?: string
  onNavigate?: () => void
}) {
  const { t } = useTranslation()
  const { pathname, search } = useLocation()
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const g = NAV_TREE.find((n) => n.kind === 'group' && groupContains(n, pathname))
    return { ...readOpen(), ...(g ? { [g.id]: true } : {}) }
  })

  // When the page changes, the category holding it opens (state adjusted during render).
  const [seenPath, setSeenPath] = useState(pathname)
  if (seenPath !== pathname) {
    setSeenPath(pathname)
    const g = NAV_TREE.find((n) => n.kind === 'group' && groupContains(n, pathname))
    if (g && !open[g.id]) setOpen({ ...open, [g.id]: true })
  }

  const toggle = (id: string) =>
    setOpen((o) => {
      const next = { ...o, [id]: !o[id] }
      try {
        localStorage.setItem(STORE, JSON.stringify(next))
      } catch {
        /* storage unavailable — state still works for this visit */
      }
      return next
    })

  return (
    <ul className={cn('flex flex-col gap-0.5', className)}>
      {NAV_TREE.map((node) => {
        if (node.kind === 'single') {
          const active = node.to === '/' ? pathname === '/' : pathname.startsWith(node.to)
          return (
            <li key={node.id}>
              <Link
                to={node.to}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  row,
                  'text-muted-foreground hover:bg-muted hover:text-foreground',
                  active && 'bg-accent font-medium text-brand-strong hover:bg-accent',
                )}
              >
                <node.icon
                  className={cn('size-[18px]', active && 'text-brand')}
                  strokeWidth={active ? 2.2 : 1.8}
                />
                {t(node.labelKey)}
              </Link>
            </li>
          )
        }
        const isOpen = !!open[node.id]
        const hasActive = groupContains(node, pathname)
        const panelId = `nav-${node.id}`
        return (
          <li key={node.id}>
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => toggle(node.id)}
              className={cn(
                row,
                'cursor-pointer text-muted-foreground hover:bg-muted hover:text-foreground',
                hasActive && 'font-medium text-foreground',
              )}
            >
              <node.icon
                className={cn('size-[18px]', hasActive && 'text-brand')}
                strokeWidth={hasActive ? 2.2 : 1.8}
              />
              <span className="flex-1 text-left">{t(node.labelKey)}</span>
              <ChevronDown
                className={cn('size-4 transition-transform duration-300', isOpen && 'rotate-180')}
              />
            </button>
            <div
              id={panelId}
              className={cn(
                'grid transition-[grid-template-rows] duration-300 ease-out',
                isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
              )}
            >
              <ul
                className={cn(
                  'ml-[1.35rem] flex min-h-0 flex-col gap-0.5 overflow-hidden border-l border-border/80 pl-2',
                  !isOpen && 'invisible',
                )}
              >
                {node.items.map((item) => {
                  const label = t(item.labelKey)
                  if (!item.to) {
                    return (
                      <li key={item.id}>
                        <span
                          aria-disabled="true"
                          title={t('navTree.soon', { m: item.milestone })}
                          className="flex h-8 cursor-not-allowed items-center gap-2 rounded-lg px-3 text-[13px] text-muted-foreground/55 select-none"
                        >
                          <span className="flex-1 truncate">{label}</span>
                          <span className="rounded-full border border-border/80 bg-muted px-1.5 py-px text-[10px] font-semibold tracking-wide text-muted-foreground/70">
                            {item.milestone}
                          </span>
                        </span>
                      </li>
                    )
                  }
                  const active = leafActive(item, pathname, search)
                  return (
                    <li key={item.id}>
                      <Link
                        to={item.to}
                        onClick={onNavigate}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex h-8 items-center rounded-lg px-3 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                          active && 'bg-accent font-medium text-brand-strong hover:bg-accent',
                        )}
                      >
                        {label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
