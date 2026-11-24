import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { supabase } from '@/lib/supabase'
import { dbErrorMessage } from './errors'
import { ACCOUNT_TYPES, accountName, accountsKey, type AccountType } from './queries'
import { descendantIds, type Account } from './tree'

const NO_PARENT = '__none__'

const schema = z.object({
  code: z.string().trim().min(1, 'required').max(20, 'tooLong'),
  name_th: z.string().trim().min(1, 'required'),
  name_en: z.string().trim(),
  type: z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']),
  parent_id: z.string(),
  is_group: z.boolean(),
})
type FormValues = z.infer<typeof schema>

interface Props {
  companyId: string
  accounts: Account[]
  /** Account to edit, or a partial preset (e.g. parent) when adding. `null` = closed. */
  target: { mode: 'edit'; account: Account } | { mode: 'add'; parent?: Account } | null
  onClose: () => void
}

function defaults(target: NonNullable<Props['target']>): FormValues {
  if (target.mode === 'edit') {
    const a = target.account
    return {
      code: a.code,
      name_th: a.name_th,
      name_en: a.name_en ?? '',
      type: a.type,
      parent_id: a.parent_id ?? NO_PARENT,
      is_group: a.is_group,
    }
  }
  return {
    code: '',
    name_th: '',
    name_en: '',
    type: target.parent?.type ?? 'expense',
    parent_id: target.parent?.id ?? NO_PARENT,
    is_group: false,
  }
}

export function AccountDialog({ companyId, accounts, target, onClose }: Props) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const editing = target?.mode === 'edit' ? target.account : null
  const isSystem = editing?.is_system ?? false

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults({ mode: 'add' }),
  })

  useEffect(() => {
    if (target) reset(defaults(target))
  }, [target, reset])

  const type = useWatch({ control, name: 'type' })
  const parentId = useWatch({ control, name: 'parent_id' })
  const isGroup = useWatch({ control, name: 'is_group' })

  // Valid parents: active groups of the same type, never the account itself or its descendants
  const parentOptions = useMemo(() => {
    const blocked = editing ? descendantIds(accounts, editing.id) : new Set<string>()
    return accounts
      .filter((a) => a.is_group && a.is_active && a.type === type && !blocked.has(a.id))
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
  }, [accounts, type, editing])

  const save = useMutation({
    mutationFn: async (v: FormValues) => {
      const row = {
        code: v.code,
        name_th: v.name_th,
        name_en: v.name_en || null,
        type: v.type,
        parent_id: v.parent_id === NO_PARENT ? null : v.parent_id,
        is_group: v.is_group,
      }
      const { error } = editing
        ? await supabase.from('accounts').update(row).eq('id', editing.id)
        : await supabase.from('accounts').insert({ ...row, company_id: companyId })
      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: accountsKey(companyId) })
      onClose()
    },
  })

  const onTypeChange = (value: AccountType) => {
    setValue('type', value)
    const parent = accounts.find((a) => a.id === parentId)
    if (parent && parent.type !== value) setValue('parent_id', NO_PARENT)
  }

  const fieldError = (key?: string) =>
    key ? <p className="text-sm text-destructive">{t(`accounts.errors.${key}`)}</p> : null

  return (
    <Dialog
      open={!!target}
      onOpenChange={(open) => {
        if (!open) {
          save.reset()
          onClose()
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? t('accounts.edit') : t('accounts.add')}</DialogTitle>
          {isSystem && <DialogDescription>{t('accounts.systemNote')}</DialogDescription>}
        </DialogHeader>

        <form
          id="account-form"
          className="flex flex-col gap-4"
          noValidate
          onSubmit={handleSubmit((v) => save.mutate(v))}
        >
          {save.error && (
            <Alert variant="destructive">
              <AlertDescription>{dbErrorMessage(t, save.error)}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="acc-code">{t('accounts.code')}</Label>
              <Input id="acc-code" aria-invalid={!!errors.code} {...register('code')} />
              {fieldError(errors.code?.message)}
            </div>
            <div className="col-span-2 grid gap-2">
              <Label htmlFor="acc-type">{t('accounts.type')}</Label>
              <Select value={type} onValueChange={onTypeChange} disabled={isSystem}>
                <SelectTrigger id="acc-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((ty) => (
                    <SelectItem key={ty} value={ty}>
                      {t(`accountTypes.${ty}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="acc-name-th">{t('accounts.nameTh')}</Label>
            <Input id="acc-name-th" aria-invalid={!!errors.name_th} {...register('name_th')} />
            {fieldError(errors.name_th?.message)}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="acc-name-en">
              {t('accounts.nameEn')}{' '}
              <span className="text-muted-foreground">({t('common.optional')})</span>
            </Label>
            <Input id="acc-name-en" {...register('name_en')} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="acc-parent">{t('accounts.parent')}</Label>
            <Select value={parentId} onValueChange={(v) => setValue('parent_id', v)}>
              <SelectTrigger id="acc-parent" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PARENT}>{t('accounts.noParent')}</SelectItem>
                {parentOptions.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.code} {accountName(a, i18n.language)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-start gap-3">
            <Switch
              id="acc-group"
              checked={isGroup}
              disabled={isSystem}
              onCheckedChange={(c) => setValue('is_group', c)}
            />
            <div className="grid gap-1">
              <Label htmlFor="acc-group">{t('accounts.isGroup')}</Label>
              <p className="text-sm text-muted-foreground">{t('accounts.isGroupHelp')}</p>
            </div>
          </div>
        </form>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="account-form" disabled={save.isPending}>
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
