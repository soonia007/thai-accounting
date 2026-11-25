import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Landmark, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { AccountingTabs } from '@/features/accounts/AccountingTabs'
import { dbErrorMessage } from '@/features/accounts/errors'
import {
  accountName,
  accountsKey,
  mappingsKey,
  useAccounts,
  useMappings,
} from '@/features/accounts/queries'
import type { Account } from '@/features/accounts/tree'
import { useCompany } from '@/features/company/CompanyProvider'
import { canEditFinanceSetup } from '@/lib/permissions'
import { supabase, type Enums, type Tables } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { ActionGroup, PageHeader } from '@/components/PageHeader'
import { BANKS, bankName, suggestLedgerCode } from './banks'

type BankAccount = Tables<'bank_accounts'>
type Kind = Enums<'bank_account_kind'>
const KINDS: Kind[] = ['savings', 'current', 'fixed', 'other']

interface FormState {
  bank_code: string
  account_number: string
  account_name: string
  branch: string
  kind: Kind
  is_active: boolean
  ledgerMode: 'new' | 'existing'
  ledger_code: string
  ledger_name: string
  existing_account_id: string
}

export function BankAccountsPage() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const { current } = useCompany()
  const companyId = current!.id
  const canEdit = canEditFinanceSetup(current?.role)

  const { data: accounts = [] } = useAccounts(companyId)
  const { data: mappings } = useMappings(companyId)
  const { data: banks = [], isLoading } = useQuery({
    queryKey: ['bank-accounts', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at')
      if (error) throw error
      return data
    },
  })

  const [editing, setEditing] = useState<BankAccount | null | undefined>(undefined)
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['bank-accounts', companyId] }),
      queryClient.invalidateQueries({ queryKey: accountsKey(companyId) }),
      queryClient.invalidateQueries({ queryKey: mappingsKey(companyId) }),
    ])

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bank_accounts').delete().eq('id', id)
      if (error) throw error
    },
    onSettled: refresh,
  })

  return (
    <div className="flex w-full flex-col gap-4">
      <PageHeader
        icon={Landmark}
        section={t('nav.accounting')}
        title={t('bankAccounts.title')}
        description={t('bankAccounts.description')}
        actions={
          canEdit && (
            <ActionGroup label={t('actionGroups.create')}>
              <Button size="sm" onClick={() => setEditing(null)}>
                <Plus className="size-4" />
                {t('bankAccounts.add')}
              </Button>
            </ActionGroup>
          )
        }
      />
      <AccountingTabs />

      {remove.error && (
        <Alert variant="destructive">
          <AlertDescription>{dbErrorMessage(t, remove.error)}</AlertDescription>
        </Alert>
      )}

      <Card className="gap-0 overflow-hidden py-0">
        {isLoading && <p className="p-4 text-sm text-muted-foreground">…</p>}
        {!isLoading && banks.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">{t('bankAccounts.empty')}</p>
        )}
        <ul className="divide-y">
          {banks.map((b) => {
            const ledger = accountById.get(b.account_id)
            return (
              <li
                key={b.id}
                className={cn(
                  'flex items-center gap-3 px-3 py-3 text-sm',
                  !b.is_active && 'text-muted-foreground',
                )}
              >
                <Landmark className="size-5 shrink-0 text-muted-foreground" />
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => canEdit && setEditing(b)}
                  aria-label={t('bankAccounts.editNamed', { number: b.account_number })}
                >
                  <span className="block truncate font-medium">
                    {bankName(b.bank_code, i18n.language)} · {b.account_number}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {b.account_name} · {t(`bankAccounts.kinds.${b.kind}`)}
                    {b.branch ? ` · ${b.branch}` : ''}
                  </span>
                </button>
                <span className="hidden text-right text-xs text-muted-foreground sm:block">
                  {ledger ? `${ledger.code} ${accountName(ledger, i18n.language)}` : ''}
                </span>
                {mappings?.get('BANK') === b.account_id && (
                  <Badge variant="secondary" className="font-normal">
                    {t('bankAccounts.default')}
                  </Badge>
                )}
                {!b.is_active && (
                  <Badge variant="outline" className="font-normal">
                    {t('accounts.inactive')}
                  </Badge>
                )}
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label={t('bankAccounts.deleteNamed', { number: b.account_number })}
                    onClick={() => {
                      if (window.confirm(t('bankAccounts.confirmDelete'))) remove.mutate(b.id)
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      </Card>

      <BankAccountDialog
        companyId={companyId}
        companyName={current?.name ?? ''}
        accounts={accounts}
        linkedIds={new Set(banks.map((b) => b.account_id))}
        bankLedgerId={mappings?.get('BANK')}
        bank={editing}
        onClose={() => setEditing(undefined)}
        onSaved={refresh}
      />
    </div>
  )
}

interface DialogProps {
  companyId: string
  companyName: string
  accounts: Account[]
  linkedIds: Set<string>
  bankLedgerId: string | undefined
  bank: BankAccount | null | undefined
  onClose: () => void
  onSaved: () => Promise<unknown>
}

/** Mounted only while open, so the form state initialises fresh each time. */
function BankAccountDialog(props: DialogProps) {
  if (props.bank === undefined) return null
  return <BankAccountFormDialog key={props.bank?.id ?? 'new'} {...props} />
}

function BankAccountFormDialog({
  companyId,
  companyName,
  accounts,
  linkedIds,
  bankLedgerId,
  bank,
  onClose,
  onSaved,
}: DialogProps) {
  const { t, i18n } = useTranslation()
  const open = true
  const [f, setF] = useState<FormState | null>(() => {
    const free = bankLedgerId && !linkedIds.has(bankLedgerId) ? bankLedgerId : ''
    const baseCode = accounts.find((a) => a.id === bankLedgerId)?.code
    return {
      bank_code: bank?.bank_code ?? 'KBANK',
      account_number: bank?.account_number ?? '',
      account_name: bank?.account_name ?? companyName,
      branch: bank?.branch ?? '',
      kind: bank?.kind ?? 'savings',
      is_active: bank?.is_active ?? true,
      // The default bank ledger account (e.g. 1120) is usually free for the first bank account
      ledgerMode: free ? 'existing' : 'new',
      ledger_code: suggestLedgerCode(baseCode, new Set(accounts.map((a) => a.code))),
      ledger_name: '',
      existing_account_id: free,
    }
  })
  const [error, setError] = useState<string | null>(null)

  const existingOptions = useMemo(
    () =>
      accounts.filter(
        (a) => a.type === 'asset' && !a.is_group && a.is_active && !linkedIds.has(a.id),
      ),
    [accounts, linkedIds],
  )

  const save = useMutation({
    mutationFn: async (v: FormState) => {
      const details = {
        bank_code: v.bank_code,
        account_number: v.account_number.trim(),
        account_name: v.account_name.trim(),
        branch: v.branch.trim() || null,
        kind: v.kind,
      }
      if (bank) {
        const { error } = await supabase
          .from('bank_accounts')
          .update({ ...details, is_active: v.is_active })
          .eq('id', bank.id)
        if (error) throw error
      } else if (v.ledgerMode === 'existing') {
        const { error } = await supabase
          .from('bank_accounts')
          .insert({ ...details, company_id: companyId, account_id: v.existing_account_id })
        if (error) throw error
      } else {
        const { error } = await supabase.rpc('create_bank_account_with_ledger', {
          p_company_id: companyId,
          p_ledger_code: v.ledger_code.trim(),
          p_ledger_name: v.ledger_name.trim() || defaultLedgerName(v),
          p_bank_code: details.bank_code,
          p_account_number: details.account_number,
          p_account_name: details.account_name,
          p_branch: details.branch ?? undefined,
          p_kind: details.kind,
        })
        if (error) throw error
      }
    },
    onSuccess: async () => {
      await onSaved()
      onClose()
    },
  })

  const defaultLedgerName = (v: FormState) =>
    `${bankName(v.bank_code, 'th')} ${t(`bankAccounts.kinds.${v.kind}`, { lng: 'th' })} ${v.account_number.replace(/\D/g, '').slice(-4)}`.trim()

  const submit = () => {
    if (!f) return
    if (!f.account_number.trim() || !f.account_name.trim()) {
      setError(t('bankAccounts.errors.required'))
      return
    }
    if (!bank && f.ledgerMode === 'new' && !f.ledger_code.trim()) {
      setError(t('bankAccounts.errors.ledgerCode'))
      return
    }
    if (!bank && f.ledgerMode === 'existing' && !f.existing_account_id) {
      setError(t('bankAccounts.errors.ledgerPick'))
      return
    }
    setError(null)
    save.mutate(f)
  }

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setF((prev) => (prev ? { ...prev, [k]: v } : prev))

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          save.reset()
          onClose()
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{bank ? t('bankAccounts.edit') : t('bankAccounts.add')}</DialogTitle>
        </DialogHeader>
        {f && (
          <div className="grid gap-4">
            {(error || save.error) && (
              <Alert variant="destructive">
                <AlertDescription>{error ?? dbErrorMessage(t, save.error)}</AlertDescription>
              </Alert>
            )}
            <div className="grid gap-2">
              <Label htmlFor="b-bank">{t('bankAccounts.bank')}</Label>
              <Select value={f.bank_code} onValueChange={(v) => set('bank_code', v)}>
                <SelectTrigger id="b-bank" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BANKS.map((b) => (
                    <SelectItem key={b.code} value={b.code}>
                      {i18n.language === 'en' ? b.en : b.th}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="b-number">{t('bankAccounts.number')}</Label>
                <Input
                  id="b-number"
                  inputMode="numeric"
                  placeholder="123-4-56789-0"
                  value={f.account_number}
                  onChange={(e) => set('account_number', e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="b-kind">{t('bankAccounts.kind')}</Label>
                <Select value={f.kind} onValueChange={(v) => set('kind', v as Kind)}>
                  <SelectTrigger id="b-kind" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KINDS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {t(`bankAccounts.kinds.${k}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="b-name">{t('bankAccounts.accountName')}</Label>
              <Input
                id="b-name"
                value={f.account_name}
                onChange={(e) => set('account_name', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="b-branch">
                {t('bankAccounts.branch')}{' '}
                <span className="text-muted-foreground">({t('common.optional')})</span>
              </Label>
              <Input
                id="b-branch"
                value={f.branch}
                onChange={(e) => set('branch', e.target.value)}
              />
            </div>

            {!bank && (
              <fieldset className="grid gap-3 rounded-xl border p-3">
                <legend className="px-1 text-sm font-medium">{t('bankAccounts.ledger')}</legend>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={f.ledgerMode === 'new'}
                    onChange={() => set('ledgerMode', 'new')}
                  />
                  {t('bankAccounts.ledgerNew')}
                </label>
                {f.ledgerMode === 'new' && (
                  <div className="grid grid-cols-3 gap-2 pl-6">
                    <Input
                      aria-label={t('accounts.code')}
                      value={f.ledger_code}
                      onChange={(e) => set('ledger_code', e.target.value)}
                    />
                    <Input
                      className="col-span-2"
                      aria-label={t('accounts.nameTh')}
                      placeholder={defaultLedgerName(f)}
                      value={f.ledger_name}
                      onChange={(e) => set('ledger_name', e.target.value)}
                    />
                  </div>
                )}
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={f.ledgerMode === 'existing'}
                    disabled={existingOptions.length === 0}
                    onChange={() => set('ledgerMode', 'existing')}
                  />
                  {t('bankAccounts.ledgerExisting')}
                </label>
                {f.ledgerMode === 'existing' && (
                  <div className="pl-6">
                    <Select
                      value={f.existing_account_id}
                      onValueChange={(v) => set('existing_account_id', v)}
                    >
                      <SelectTrigger className="w-full" aria-label={t('bankAccounts.ledger')}>
                        <SelectValue placeholder={t('bankAccounts.ledgerPick')} />
                      </SelectTrigger>
                      <SelectContent>
                        {existingOptions.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.code} {accountName(a, i18n.language)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </fieldset>
            )}

            {bank && (
              <div className="flex items-center gap-2">
                <Switch
                  id="b-active"
                  checked={f.is_active}
                  onCheckedChange={(c) => set('is_active', c)}
                />
                <Label htmlFor="b-active">{t('common.active')}</Label>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submit} disabled={save.isPending}>
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
