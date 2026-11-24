import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Factory, Briefcase, ShoppingBag, UtensilsCrossed, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/features/auth/AuthProvider'
import { myCompaniesKey, useCompany } from '@/features/company/CompanyProvider'
import { MyInvitations } from '@/features/company/MyInvitations'
import { supabase, type BusinessType } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { companySchema, type CompanyFormInput, type CompanyFormValues } from './company-schema'

const BUSINESS_TYPES: { value: BusinessType; icon: LucideIcon }[] = [
  { value: 'service', icon: Briefcase },
  { value: 'trading', icon: ShoppingBag },
  { value: 'manufacturing', icon: Factory },
  { value: 'restaurant', icon: UtensilsCrossed },
]

export function OnboardingPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const { companies, switchCompany } = useCompany()
  const [step, setStep] = useState<1 | 2>(1)
  const [businessType, setBusinessType] = useState<BusinessType | null>(null)

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<CompanyFormInput, unknown, CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: '',
      taxId: '',
      isHeadOffice: true,
      branchCode: '',
      address: '',
      vatRegistered: false,
    },
  })
  const isHeadOffice = useWatch({ control, name: 'isHeadOffice' })
  const vatRegistered = useWatch({ control, name: 'vatRegistered' })

  const create = useMutation({
    mutationFn: async (v: CompanyFormValues) => {
      const { data, error } = await supabase.rpc('create_company', {
        p_name: v.name,
        p_business_type: businessType!,
        p_tax_id: v.taxId || undefined,
        p_branch_code: v.isHeadOffice ? '00000' : v.branchCode,
        p_address: v.address || undefined,
        p_vat_registered: v.vatRegistered,
      })
      if (error) throw error
      return data
    },
    onSuccess: async (companyId) => {
      switchCompany(companyId)
      await queryClient.invalidateQueries({ queryKey: myCompaniesKey(session?.user.id) })
      navigate('/', { replace: true })
    },
  })

  const fieldError = (key?: string) =>
    key ? <p className="text-sm text-destructive">{t(`onboarding.errors.${key}`)}</p> : null

  return (
    <div className="pt-safe pb-safe mx-auto flex min-h-dvh max-w-2xl flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <span className="font-semibold">{t('app.name')}</span>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Button variant="ghost" size="sm" onClick={() => void supabase.auth.signOut()}>
            {t('auth.signOut')}
          </Button>
        </div>
      </div>

      <MyInvitations />

      <Card>
        <CardHeader>
          <CardTitle>{t('onboarding.title')}</CardTitle>
          <CardDescription>
            {t('onboarding.step', { step, total: 2 })} ·{' '}
            {step === 1 ? t('onboarding.chooseType') : t('onboarding.companyInfo')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 1 ? (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup">
                {BUSINESS_TYPES.map(({ value, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={businessType === value}
                    onClick={() => setBusinessType(value)}
                    className={cn(
                      'flex items-start gap-3 rounded-lg border p-4 text-left transition hover:bg-accent',
                      businessType === value && 'border-primary ring-2 ring-primary',
                    )}
                  >
                    <Icon className="mt-0.5 size-5 shrink-0" />
                    <span>
                      <span className="block font-medium">{t(`businessTypes.${value}.name`)}</span>
                      <span className="block text-sm text-muted-foreground">
                        {t(`businessTypes.${value}.description`)}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">{t('onboarding.chartNote')}</p>
              <div className="flex justify-between">
                {companies.length > 0 ? (
                  <Button variant="ghost" onClick={() => navigate('/')}>
                    {t('common.cancel')}
                  </Button>
                ) : (
                  <span />
                )}
                <Button disabled={!businessType} onClick={() => setStep(2)}>
                  {t('common.next')}
                </Button>
              </div>
            </div>
          ) : (
            <form
              className="flex flex-col gap-4"
              noValidate
              onSubmit={handleSubmit((v) => create.mutate(v))}
            >
              {create.error && (
                <Alert variant="destructive">
                  <AlertDescription>{create.error.message}</AlertDescription>
                </Alert>
              )}
              <div className="grid gap-2">
                <Label htmlFor="name">{t('company.name')}</Label>
                <Input id="name" aria-invalid={!!errors.name} {...register('name')} />
                {fieldError(errors.name?.message)}
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="vatRegistered"
                  checked={vatRegistered}
                  onCheckedChange={(c) => setValue('vatRegistered', c === true)}
                />
                <Label htmlFor="vatRegistered">{t('company.vatRegistered')}</Label>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="taxId">
                  {t('company.taxId')}
                  {!vatRegistered && (
                    <span className="text-muted-foreground"> ({t('common.optional')})</span>
                  )}
                </Label>
                <Input
                  id="taxId"
                  inputMode="numeric"
                  maxLength={17}
                  aria-invalid={!!errors.taxId}
                  {...register('taxId')}
                />
                {fieldError(errors.taxId?.message)}
              </div>

              <div className="grid gap-2">
                <span className="text-sm font-medium">{t('company.branch')}</span>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      checked={isHeadOffice}
                      onChange={() => setValue('isHeadOffice', true)}
                    />
                    {t('company.headOffice')}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      checked={!isHeadOffice}
                      onChange={() => setValue('isHeadOffice', false)}
                    />
                    {t('company.branchNo')}
                  </label>
                  {!isHeadOffice && (
                    <Input
                      aria-label={t('company.branchNo')}
                      className="w-28"
                      inputMode="numeric"
                      maxLength={5}
                      placeholder="00001"
                      aria-invalid={!!errors.branchCode}
                      {...register('branchCode')}
                    />
                  )}
                </div>
                {fieldError(errors.branchCode?.message)}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="address">{t('company.address')}</Label>
                <Input id="address" {...register('address')} />
              </div>

              <div className="flex justify-between">
                <Button type="button" variant="ghost" onClick={() => setStep(1)}>
                  {t('common.back')}
                </Button>
                <Button type="submit" disabled={create.isPending}>
                  {t('onboarding.create')}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
