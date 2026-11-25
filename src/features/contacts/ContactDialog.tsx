import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
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
import { supabase } from '@/lib/supabase'
import { isValidThaiTaxId, normalizeTaxId } from '@/lib/tax-id'
import type { Contact } from './contact-csv'

const schema = z
  .object({
    code: z.string().trim(),
    name: z.string().trim().min(1, 'required'),
    contact_type: z.enum(['customer', 'vendor', 'both']),
    entity_type: z.enum(['juristic', 'individual']),
    tax_id: z
      .string()
      .transform(normalizeTaxId)
      .refine((v) => v === '' || isValidThaiTaxId(v), 'taxId'),
    is_head_office: z.boolean(),
    branch_code: z.string().trim(),
    branch_name: z.string().trim(),
    address: z.string().trim(),
    contact_person: z.string().trim(),
    phone: z.string().trim(),
    email: z.union([z.literal(''), z.email('email')]),
    credit_term_days: z.coerce
      .number<string>()
      .int('creditTerm')
      .min(0, 'creditTerm')
      .max(365, 'creditTerm'),
    notes: z.string().trim(),
    is_active: z.boolean(),
  })
  .refine((v) => v.is_head_office || /^\d{5}$/.test(v.branch_code), {
    path: ['branch_code'],
    message: 'branchCode',
  })
type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

function defaults(c: Contact | null): FormInput {
  return {
    code: c?.code ?? '',
    name: c?.name ?? '',
    contact_type: c?.contact_type ?? 'customer',
    entity_type: c?.entity_type ?? 'juristic',
    tax_id: c?.tax_id ?? '',
    is_head_office: !c || c.branch_code === '00000',
    branch_code: c && c.branch_code !== '00000' ? c.branch_code : '',
    branch_name: c?.branch_name ?? '',
    address: c?.address ?? '',
    contact_person: c?.contact_person ?? '',
    phone: c?.phone ?? '',
    email: c?.email ?? '',
    credit_term_days: String(c?.credit_term_days ?? 0),
    notes: c?.notes ?? '',
    is_active: c?.is_active ?? true,
  }
}

interface Props {
  companyId: string
  /** `undefined` = closed, `null` = new contact */
  contact: Contact | null | undefined
  onClose: () => void
}

export function ContactDialog({ companyId, contact, onClose }: Props) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const open = contact !== undefined

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults(null),
  })
  useEffect(() => {
    if (open) reset(defaults(contact ?? null))
  }, [open, contact, reset])

  const [contactType, entityType, isHeadOffice, isActive] = useWatch({
    control,
    name: ['contact_type', 'entity_type', 'is_head_office', 'is_active'],
  })

  const save = useMutation({
    mutationFn: async (v: FormValues) => {
      const row = {
        // empty → the DB assigns the next code
        code: v.code,
        name: v.name,
        contact_type: v.contact_type,
        entity_type: v.entity_type,
        tax_id: v.tax_id || null,
        branch_code: v.is_head_office ? '00000' : v.branch_code,
        branch_name: v.branch_name || null,
        address: v.address || null,
        contact_person: v.contact_person || null,
        phone: v.phone || null,
        email: v.email || null,
        credit_term_days: v.credit_term_days,
        notes: v.notes || null,
        is_active: v.is_active,
      }
      const { error } = contact
        ? await supabase.from('contacts').update(row).eq('id', contact.id)
        : await supabase.from('contacts').insert({ ...row, company_id: companyId })
      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['contacts', companyId] })
      onClose()
    },
  })

  const fe = (key?: string) =>
    key ? <p className="text-sm text-destructive">{t(`contacts.errors.${key}`)}</p> : null

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
          <DialogTitle>{contact ? t('contacts.edit') : t('contacts.add')}</DialogTitle>
        </DialogHeader>
        <form
          id="contact-form"
          className="grid gap-4 sm:grid-cols-2"
          noValidate
          onSubmit={handleSubmit((v) => save.mutate(v))}
        >
          {save.error && (
            <Alert variant="destructive" className="sm:col-span-2">
              <AlertDescription>{dbErrorMessage(t, save.error)}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-2">
            <Label htmlFor="c-type">{t('contacts.contactType')}</Label>
            <Select
              value={contactType}
              onValueChange={(v) => setValue('contact_type', v as FormValues['contact_type'])}
            >
              <SelectTrigger id="c-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(['customer', 'vendor', 'both'] as const).map((v) => (
                  <SelectItem key={v} value={v}>
                    {t(`contacts.types.${v}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="c-entity">{t('contacts.entityType')}</Label>
            <Select
              value={entityType}
              onValueChange={(v) => setValue('entity_type', v as FormValues['entity_type'])}
            >
              <SelectTrigger id="c-entity" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(['juristic', 'individual'] as const).map((v) => (
                  <SelectItem key={v} value={v}>
                    {t(`contacts.entities.${v}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="c-name">{t('contacts.name')}</Label>
            <Input id="c-name" aria-invalid={!!errors.name} {...register('name')} />
            {fe(errors.name?.message)}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="c-code">
              {t('contacts.code')}{' '}
              <span className="text-muted-foreground">({t('contacts.codeAuto')})</span>
            </Label>
            <Input id="c-code" {...register('code')} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="c-tax">
              {entityType === 'individual' ? t('contacts.nationalId') : t('company.taxId')}{' '}
              <span className="text-muted-foreground">({t('common.optional')})</span>
            </Label>
            <Input
              id="c-tax"
              inputMode="numeric"
              maxLength={17}
              aria-invalid={!!errors.tax_id}
              {...register('tax_id')}
            />
            {fe(errors.tax_id?.message)}
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <span className="text-sm font-medium">{t('company.branch')}</span>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={isHeadOffice}
                  onChange={() => setValue('is_head_office', true)}
                />
                {t('company.headOffice')}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={!isHeadOffice}
                  onChange={() => setValue('is_head_office', false)}
                />
                {t('company.branchNo')}
              </label>
              {!isHeadOffice && (
                <>
                  <Input
                    aria-label={t('company.branchNo')}
                    className="w-28"
                    inputMode="numeric"
                    maxLength={5}
                    placeholder="00001"
                    aria-invalid={!!errors.branch_code}
                    {...register('branch_code')}
                  />
                  <Input
                    aria-label={t('contacts.branchName')}
                    placeholder={t('contacts.branchName')}
                    className="w-48"
                    {...register('branch_name')}
                  />
                </>
              )}
            </div>
            {fe(errors.branch_code?.message)}
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="c-address">{t('company.address')}</Label>
            <Input id="c-address" {...register('address')} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="c-person">{t('contacts.contactPerson')}</Label>
            <Input id="c-person" {...register('contact_person')} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="c-phone">{t('contacts.phone')}</Label>
            <Input id="c-phone" type="tel" {...register('phone')} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="c-email">{t('auth.email')}</Label>
            <Input id="c-email" type="email" aria-invalid={!!errors.email} {...register('email')} />
            {fe(errors.email?.message)}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="c-term">{t('contacts.creditTerm')}</Label>
            <Input
              id="c-term"
              type="number"
              min={0}
              max={365}
              aria-invalid={!!errors.credit_term_days}
              {...register('credit_term_days')}
            />
            {fe(errors.credit_term_days?.message)}
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="c-notes">{t('contacts.notes')}</Label>
            <Input id="c-notes" {...register('notes')} />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="c-active"
              checked={isActive}
              onCheckedChange={(c) => setValue('is_active', c)}
            />
            <Label htmlFor="c-active">{t('common.active')}</Label>
          </div>
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="contact-form" disabled={save.isPending}>
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
