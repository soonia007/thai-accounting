import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { dbErrorMessage } from '@/features/accounts/errors'
import { useAuth } from '@/features/auth/AuthProvider'
import { CompanyLogoCard } from '@/features/company/CompanyLogoCard'
import { canManageMembers, myCompaniesKey, useCompany } from '@/features/company/CompanyProvider'
import { supabase } from '@/lib/supabase'
import { isValidThaiTaxId, normalizeTaxId } from '@/lib/tax-id'

const schema = z
  .object({
    name: z.string().trim().min(1, 'required'),
    name_en: z.string().trim(),
    address: z.string().trim(),
    tax_id: z
      .string()
      .transform(normalizeTaxId)
      .refine((v) => v === '' || isValidThaiTaxId(v), 'taxId'),
    is_head_office: z.boolean(),
    branch_code: z.string().trim(),
    branch_name: z.string().trim(),
    phone: z.string().trim(),
    email: z.union([z.literal(''), z.email('email')]),
    date_era: z.enum(['BE', 'CE']),
  })
  .refine((v) => v.is_head_office || /^\d{5}$/.test(v.branch_code), {
    path: ['branch_code'],
    message: 'branchCode',
  })
type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

/** Company details printed on documents (PDF header). */
export function CompanySettingsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const { current } = useCompany()
  const canEdit = canManageMembers(current?.role)
  const [saved, setSaved] = useState(false)

  const company = useQuery({
    queryKey: ['company', current!.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', current!.id)
        .single()
      if (error) throw error
      return data
    },
  })

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    // controlled from the first render (values arrive after the company loads)
    defaultValues: {
      name: '',
      name_en: '',
      address: '',
      tax_id: '',
      is_head_office: true,
      branch_code: '',
      branch_name: '',
      phone: '',
      email: '',
      date_era: 'BE',
    },
  })
  useEffect(() => {
    const c = company.data
    if (!c) return
    reset({
      name: c.name,
      name_en: c.name_en ?? '',
      address: c.address ?? '',
      tax_id: c.tax_id ?? '',
      is_head_office: c.branch_code === '00000',
      branch_code: c.branch_code === '00000' ? '' : c.branch_code,
      branch_name: c.branch_name ?? '',
      phone: c.phone ?? '',
      email: c.email ?? '',
      date_era: c.date_era,
    })
  }, [company.data, reset])
  const isHeadOffice = useWatch({ control, name: 'is_head_office' })

  const save = useMutation({
    mutationFn: async (v: FormValues) => {
      const { error } = await supabase
        .from('companies')
        .update({
          name: v.name,
          name_en: v.name_en || null,
          address: v.address || null,
          tax_id: v.tax_id || null,
          branch_code: v.is_head_office ? '00000' : v.branch_code,
          branch_name: v.is_head_office ? null : v.branch_name || null,
          phone: v.phone || null,
          email: v.email || null,
          date_era: v.date_era,
        })
        .eq('id', current!.id)
      if (error) throw error
    },
    onSuccess: async () => {
      setSaved(true)
      await queryClient.invalidateQueries({ queryKey: ['company', current!.id] })
      await queryClient.invalidateQueries({ queryKey: myCompaniesKey(session?.user.id) })
    },
  })

  const fe = (key?: string) =>
    key ? (
      <p className="text-sm text-destructive">
        {t(`onboarding.errors.${key}`, { defaultValue: t(`contacts.errors.${key}`) })}
      </p>
    ) : null

  return (
    <div className="flex w-full flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight md:text-[28px]">
        {t('companySettings.title')}
      </h1>
      {company.data && (
        <CompanyLogoCard
          companyId={current!.id}
          logoPath={company.data.logo_path}
          canEdit={canEdit}
        />
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('companySettings.printed')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 sm:grid-cols-2"
            noValidate
            onSubmit={handleSubmit((v) => {
              setSaved(false)
              save.mutate(v)
            })}
          >
            {save.error && (
              <Alert variant="destructive" className="sm:col-span-2">
                <AlertDescription>{dbErrorMessage(t, save.error)}</AlertDescription>
              </Alert>
            )}
            {saved && (
              <Alert className="sm:col-span-2">
                <AlertDescription>{t('companySettings.saved')}</AlertDescription>
              </Alert>
            )}
            <fieldset disabled={!canEdit} className="contents">
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="cs-name">{t('company.name')}</Label>
                <Input id="cs-name" aria-invalid={!!errors.name} {...register('name')} />
                {fe(errors.name?.message)}
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="cs-name-en">{t('companySettings.nameEn')}</Label>
                <Input id="cs-name-en" {...register('name_en')} />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="cs-address">{t('company.address')}</Label>
                <Input id="cs-address" {...register('address')} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cs-tax">{t('company.taxId')}</Label>
                <Input
                  id="cs-tax"
                  inputMode="numeric"
                  maxLength={17}
                  aria-invalid={!!errors.tax_id}
                  {...register('tax_id')}
                />
                {fe(errors.tax_id?.message)}
              </div>
              <div className="grid gap-2">
                <span className="text-sm font-medium">{t('company.branch')}</span>
                <div className="flex flex-wrap items-center gap-3">
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
                </div>
                {!isHeadOffice && (
                  <div className="flex gap-2">
                    <Input
                      aria-label={t('company.branchNo')}
                      className="w-24"
                      maxLength={5}
                      placeholder="00001"
                      {...register('branch_code')}
                    />
                    <Input
                      aria-label={t('contacts.branchName')}
                      placeholder={t('contacts.branchName')}
                      {...register('branch_name')}
                    />
                  </div>
                )}
                {fe(errors.branch_code?.message)}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cs-phone">{t('contacts.phone')}</Label>
                <Input id="cs-phone" type="tel" {...register('phone')} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cs-email">{t('auth.email')}</Label>
                <Input id="cs-email" type="email" {...register('email')} />
                {fe(errors.email?.message)}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cs-era">{t('companySettings.dateEra')}</Label>
                <select
                  id="cs-era"
                  className="h-10 rounded-xl border bg-card pr-9 pl-3.5 text-sm shadow-xs"
                  {...register('date_era')}
                >
                  <option value="BE">{t('companySettings.eraBE')}</option>
                  <option value="CE">{t('companySettings.eraCE')}</option>
                </select>
              </div>
            </fieldset>
            <p className="text-xs text-muted-foreground sm:col-span-2">
              {t('companySettings.vatNote')}
            </p>
            {canEdit && (
              <div className="flex justify-end sm:col-span-2">
                <Button type="submit" disabled={save.isPending}>
                  {t('common.save')}
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
