import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ChevronDown,
  ChevronRight,
  Lock,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  Search,
  Trash2,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useCompany } from '@/features/company/CompanyProvider'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { AccountDialog } from './AccountDialog'
import { AccountingTabs } from './AccountingTabs'
import { dbErrorMessage } from './errors'
import {
  accountName,
  accountsKey,
  canEditAccounts,
  useAccounts,
  useMappings,
  type AccountRole,
} from './queries'
import { buildTree, filterTree, flattenTree, type Account } from './tree'

type DialogTarget = { mode: 'edit'; account: Account } | { mode: 'add'; parent?: Account } | null

export function ChartOfAccountsPage() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const { current } = useCompany()
  const companyId = current!.id
  const canEdit = canEditAccounts(current?.role)

  const { data: accounts = [], isLoading } = useAccounts(companyId)
  const { data: mappings } = useMappings(companyId)

  const [query, setQuery] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [dialog, setDialog] = useState<DialogTarget>(null)

  // Roles each account is mapped to, for the badge
  const rolesByAccount = useMemo(() => {
    const map = new Map<string, AccountRole[]>()
    mappings?.forEach((accountId, role) => {
      map.set(accountId, [...(map.get(accountId) ?? []), role])
    })
    return map
  }, [mappings])

  const rows = useMemo(() => {
    const tree = filterTree(buildTree(accounts), query, showInactive)
    // While searching, show every match regardless of collapsed state
    return flattenTree(tree, query.trim() ? new Set() : collapsed)
  }, [accounts, query, showInactive, collapsed])

  const refresh = () => queryClient.invalidateQueries({ queryKey: accountsKey(companyId) })

  const setActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from('accounts').update({ is_active: active }).eq('id', id)
      if (error) throw error
    },
    // A new action replaces any earlier error message
    onMutate: (): void => remove.reset(),
    onSettled: refresh,
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error, count } = await supabase
        .from('accounts')
        .delete({ count: 'exact' })
        .eq('id', id)
      if (error) throw error
      if (count === 0) throw { code: '42501' }
    },
    onMutate: (): void => setActive.reset(),
    onSettled: refresh,
  })

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const collapseAll = () =>
    setCollapsed(new Set(accounts.filter((a) => a.is_group).map((a) => a.id)))

  const actionError = setActive.error ?? remove.error

  const openDialog = (target: DialogTarget) => {
    setActive.reset()
    remove.reset()
    setDialog(target)
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight md:text-[28px]">
        {t('nav.accounting')}
      </h1>
      <AccountingTabs />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder={t('accounts.search')}
            aria-label={t('accounts.search')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch id="show-inactive" checked={showInactive} onCheckedChange={setShowInactive} />
          <Label htmlFor="show-inactive" className="text-sm">
            {t('accounts.showInactive')}
          </Label>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => setCollapsed(new Set())}>
            {t('accounts.expandAll')}
          </Button>
          <Button variant="ghost" size="sm" onClick={collapseAll}>
            {t('accounts.collapseAll')}
          </Button>
        </div>
        {canEdit && (
          <Button onClick={() => openDialog({ mode: 'add' })}>
            <Plus className="size-4" />
            {t('accounts.add')}
          </Button>
        )}
      </div>

      {actionError && (
        <Alert variant="destructive">
          <AlertDescription>{dbErrorMessage(t, actionError)}</AlertDescription>
        </Alert>
      )}

      <Card className="gap-0 overflow-hidden py-0">
        {isLoading && <p className="p-4 text-sm text-muted-foreground">…</p>}
        {!isLoading && rows.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">{t('accounts.empty')}</p>
        )}
        <ul role="tree" aria-label={t('accounts.title')} className="divide-y">
          {rows.map(({ account: a, depth, hasChildren }) => {
            const isCollapsed = collapsed.has(a.id) && !query.trim()
            const roles = rolesByAccount.get(a.id)
            return (
              <li
                key={a.id}
                role="treeitem"
                aria-level={depth + 1}
                aria-expanded={hasChildren ? !isCollapsed : undefined}
                className={cn(
                  'flex items-center gap-2 py-2 pr-2 text-sm',
                  a.is_group && 'bg-muted/40 font-medium',
                  !a.is_active && 'text-muted-foreground',
                )}
                style={{ paddingLeft: `${0.5 + depth * 1.25}rem` }}
              >
                {hasChildren ? (
                  <button
                    type="button"
                    className="rounded p-0.5 hover:bg-accent"
                    aria-label={isCollapsed ? t('accounts.expand') : t('accounts.collapse')}
                    onClick={() => toggle(a.id)}
                  >
                    {isCollapsed ? (
                      <ChevronRight className="size-4" />
                    ) : (
                      <ChevronDown className="size-4" />
                    )}
                  </button>
                ) : (
                  <span className="w-5 shrink-0" />
                )}
                <span className="w-14 shrink-0 font-mono tabular-nums">{a.code}</span>
                <span className="min-w-0 flex-1 truncate">{accountName(a, i18n.language)}</span>
                <span className="hidden flex-wrap justify-end gap-1 sm:flex">
                  {roles?.map((r) => (
                    <Badge key={r} variant="secondary" className="font-normal">
                      {t(`accountRoles.${r}`)}
                    </Badge>
                  ))}
                  {!a.is_active && (
                    <Badge variant="outline" className="font-normal">
                      {t('accounts.inactive')}
                    </Badge>
                  )}
                </span>
                <span className="hidden w-24 shrink-0 text-right text-xs text-muted-foreground md:inline">
                  {t(`accountTypes.${a.type}`)}
                </span>
                {a.is_system ? (
                  <Lock
                    className="size-3.5 shrink-0 text-muted-foreground"
                    aria-label={t('accounts.system')}
                  />
                ) : (
                  <span className="w-3.5 shrink-0" />
                )}
                {canEdit && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label={t('accounts.actions', { code: a.code })}
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => openDialog({ mode: 'edit', account: a })}>
                        <Pencil className="size-4" />
                        {t('accounts.edit')}
                      </DropdownMenuItem>
                      {a.is_group && a.is_active && (
                        <DropdownMenuItem onSelect={() => openDialog({ mode: 'add', parent: a })}>
                          <Plus className="size-4" />
                          {t('accounts.addChild')}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onSelect={() => setActive.mutate({ id: a.id, active: !a.is_active })}
                      >
                        <Power className="size-4" />
                        {a.is_active ? t('accounts.deactivate') : t('accounts.activate')}
                      </DropdownMenuItem>
                      {!a.is_system && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => {
                              if (window.confirm(t('accounts.confirmDelete', { code: a.code })))
                                remove.mutate(a.id)
                            }}
                          >
                            <Trash2 className="size-4" />
                            {t('accounts.delete')}
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </li>
            )
          })}
        </ul>
      </Card>

      <AccountDialog
        companyId={companyId}
        accounts={accounts}
        target={dialog}
        onClose={() => setDialog(null)}
      />
    </div>
  )
}
