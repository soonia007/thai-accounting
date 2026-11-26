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
import { dbErrorMessage } from '@/features/accounts/errors'
import { accountName } from '@/features/accounts/queries'
import type { Account } from '@/features/accounts/tree'
import { parseMoney } from '@/lib/csv'
import { supabase } from '@/lib/supabase'
import { useWhtIncomeTypes } from '@/features/wht/queries'
import type { Product } from './product-csv'

const DEFAULT = '__default__'

const money = z
  .string()
  .trim()
  .refine((v) => {
    const n = parseMoney(v)
    return n === null || (!Number.isNaN(n) && n >= 0)
  }, 'money')

const schema = z.object({
  code: z.string().trim(),
  name: z.string().trim().min(1, 'required'),
  kind: z.enum(['product', 'service']),
  unit: z.string().trim(),
  sale_price: money,
  purchase_price: money,
  vat_type: z.enum(['standard', 'zero', 'exempt']),
  income_account_id: z.string(),
  expense_account_id: z.string(),
  wht_income_type: z.string(),
  description: z.string().trim(),
  is_active: z.boolean(),
})
type FormValues = z.infer<typeof schema>

const fmt = (n: number | null | undefined) => (n === null || n === undefined ? '' : n.toFixed(2))

function defaults(p: Product | null): FormValues {
  return {
    code: p?.code ?? '',
    name: p?.name ?? '',
    kind: p?.kind ?? 'service',
    unit: p?.unit ?? '',
    sale_price: fmt(p?.sale_price),
    purchase_price: fmt(p?.purchase_price),
    vat_type: p?.vat_type ?? 'standard',
    income_account_id: p?.income_account_id ?? DEFAULT,
    expense_account_id: p?.expense_account_id ?? DEFAULT,
    wht_income_type: p?.wht_income_type ?? '',
    description: p?.description ?? '',
    is_active: p?.is_active ?? true,
  }
}

interface Props {
  companyId: string
  vatRegistered: boolean
  accounts: Account[]
  product: Product | null | undefined
  onClose: () => void
  /** New product only: preset name (e.g. what was typed on the document line) */
  defaultName?: string
  /** New product only: called with the saved row, e.g. to put it on the line that opened it */
  onCreated?: (product: Product) => void
}

export function ProductDialog({
  companyId,
  vatRegistered,
  accounts,
  product,
  onClose,
  defaultName,
  onCreated,
}: Props) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const open = product !== undefined
  const incomeTypes = useWhtIncomeTypes(open)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults(null) })
  useEffect(() => {
    if (open)
      reset({
        ...defaults(product ?? null),
        ...(!product && defaultName ? { name: defaultName } : {}),
      })
  }, [open, product, reset, defaultName])

  const [kind, vatType, incomeId, expenseId, isActive] = useWatch({
    control,
    name: ['kind', 'vat_type', 'income_account_id', 'expense_account_id', 'is_active'],
  })

  const postable = (a: Account, keep: string) => !a.is_group && (a.is_active || a.id === keep)
  const incomeOptions = useMemo(
    () => accounts.filter((a) => a.type === 'revenue' && postable(a, incomeId)),
    [accounts, incomeId],
  )
  const expenseOptions = useMemo(
    () =>
      accounts.filter(
        (a) => (a.type === 'expense' || a.type === 'asset') && postable(a, expenseId),
      ),
    [accounts, expenseId],
  )

  const save = useMutation({
    mutationFn: async (v: FormValues) => {
      const row = {
        code: v.code,
        name: v.name,
        kind: v.kind,
        unit: v.unit || null,
        sale_price: parseMoney(v.sale_price),
        purchase_price: parseMoney(v.purchase_price),
        vat_type: v.vat_type,
        income_account_id: v.income_account_id === DEFAULT ? null : v.income_account_id,
        expense_account_id: v.expense_account_id === DEFAULT ? null : v.expense_account_id,
        wht_income_type: v.wht_income_type || null,
        description: v.description || null,
        is_active: v.is_active,
      }
      if (product) {
        const { error } = await supabase.from('products').update(row).eq('id', product.id)
        if (error) throw error
        return null
      }
      const { data, error } = await supabase
        .from('products')
        .insert({ ...row, company_id: companyId })
        .select()
        .single()
      if (error) throw error
      return data as Product
    },
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ['products', companyId] })
      if (created) onCreated?.(created)
      onClose()
    },
  })

  const fe = (key?: string) =>
    key ? <p className="text-sm text-destructive">{t(`products.errors.${key}`)}</p> : null

  const accountSelect = (
    id: string,
    label: string,
    value: string,
    onChange: (v: string) => void,
    options: Account[],
    defaultLabel: string,
  ) => (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={DEFAULT}>{defaultLabel}</SelectItem>
          {options.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.code} {accountName(a, i18n.language)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )

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
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{product ? t('products.edit') : t('products.add')}</DialogTitle>
        </DialogHeader>
        <form
          id="product-form"
          className="grid gap-4 sm:grid-cols-2"
          noValidate
          onSubmit={(e) => {
            // opened from inside another form (e.g. an invoice): React bubbles submit through
            // the portal, so keep it from also submitting that form
            e.stopPropagation()
            void handleSubmit((v) => save.mutate(v))(e)
          }}
        >
          {save.error && (
            <Alert variant="destructive" className="sm:col-span-2">
              <AlertDescription>{dbErrorMessage(t, save.error)}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-2 sm:col-span-2">
            <span className="text-sm font-medium">{t('products.kind')}</span>
            <div className="flex gap-4">
              {(['service', 'product'] as const).map((k) => (
                <label key={k} className="flex items-center gap-2 text-sm">
                  <input type="radio" checked={kind === k} onChange={() => setValue('kind', k)} />
                  {t(`products.kinds.${k}`)}
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="p-name">{t('products.name')}</Label>
            <Input id="p-name" aria-invalid={!!errors.name} {...register('name')} />
            {fe(errors.name?.message)}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="p-code">
              {t('contacts.code')}{' '}
              <span className="text-muted-foreground">({t('contacts.codeAuto')})</span>
            </Label>
            <Input id="p-code" {...register('code')} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="p-unit">{t('products.unit')}</Label>
            <Input id="p-unit" placeholder={t('products.unitPlaceholder')} {...register('unit')} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="p-sale">{t('products.salePrice')}</Label>
            <Input
              id="p-sale"
              inputMode="decimal"
              aria-invalid={!!errors.sale_price}
              {...register('sale_price')}
            />
            {fe(errors.sale_price?.message)}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="p-purchase">{t('products.purchasePrice')}</Label>
            <Input
              id="p-purchase"
              inputMode="decimal"
              aria-invalid={!!errors.purchase_price}
              {...register('purchase_price')}
            />
            {fe(errors.purchase_price?.message)}
          </div>
          <p className="-mt-2 text-xs text-muted-foreground sm:col-span-2">
            {t('products.priceNote')}
          </p>

          {vatRegistered && (
            <div className="grid gap-2">
              <Label htmlFor="p-vat">{t('products.vatType')}</Label>
              <Select
                value={vatType}
                onValueChange={(v) => setValue('vat_type', v as FormValues['vat_type'])}
              >
                <SelectTrigger id="p-vat" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['standard', 'zero', 'exempt'] as const).map((v) => (
                    <SelectItem key={v} value={v}>
                      {t(`products.vatTypes.${v}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="sm:col-span-2" />
          {accountSelect(
            'p-income',
            t('products.incomeAccount'),
            incomeId,
            (v) => setValue('income_account_id', v),
            incomeOptions,
            t('products.useMapping', { role: t('accountRoles.SALES_REVENUE') }),
          )}
          {accountSelect(
            'p-expense',
            t('products.expenseAccount'),
            expenseId,
            (v) => setValue('expense_account_id', v),
            expenseOptions,
            t('products.useMapping', { role: t('accountRoles.DEFAULT_EXPENSE') }),
          )}

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="p-wht">{t('wht.defaultIncomeType')}</Label>
            <select
              id="p-wht"
              className="h-10 rounded-xl border bg-card pr-9 pl-3.5 text-sm shadow-xs"
              {...register('wht_income_type')}
            >
              <option value="">{t('wht.noWithholding')}</option>
              {(incomeTypes.data ?? []).map((x) => (
                <option key={x.code} value={x.code}>
                  {i18n.language === 'en' ? x.name_en : x.name_th} {x.section}
                  {x.default_rate ? ` ${x.default_rate}%` : ''}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">{t('wht.defaultIncomeTypeHelp')}</p>
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="p-desc">{t('products.description')}</Label>
            <Input id="p-desc" {...register('description')} />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="p-active"
              checked={isActive}
              onCheckedChange={(c) => setValue('is_active', c)}
            />
            <Label htmlFor="p-active">{t('common.active')}</Label>
          </div>
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="product-form" disabled={save.isPending}>
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
