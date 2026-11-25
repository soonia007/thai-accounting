import {
  ArrowRight,
  CircleDollarSign,
  FilePlus2,
  Receipt,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useCompany } from '@/features/company/CompanyProvider'
import { MyInvitations } from '@/features/company/MyInvitations'

interface Action {
  to: string
  icon: LucideIcon
  label: string
  tint: string
}

/** Home until the M8 dashboard: greeting + the most common next actions. */
export function HelloPage() {
  const { t } = useTranslation()
  const { current } = useCompany()
  const actions: Action[] = [
    {
      to: '/sales/new/invoice',
      icon: FilePlus2,
      label: t('docTypes.invoice'),
      tint: 'bg-accent text-brand',
    },
    {
      to: '/sales/payments/new',
      icon: CircleDollarSign,
      label: t('docs.newPayment.sales'),
      tint: 'bg-success/12 text-success',
    },
    {
      to: '/purchases/new/bill',
      icon: Receipt,
      label: t('docTypes.bill'),
      tint: 'bg-warning/15 text-warning-foreground',
    },
    { to: '/contacts', icon: Users, label: t('nav.contacts'), tint: 'bg-muted text-brand-mid' },
  ]
  return (
    <div className="flex w-full flex-col gap-6">
      <MyInvitations />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-[28px]">{t('hello.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('hello.workingIn', { company: current?.name })} ·{' '}
          {current && t(`roles.${current.role}`)}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {actions.map(({ to, icon: Icon, label, tint }) => (
          <Link
            key={to}
            to={to}
            className="group flex flex-col gap-4 rounded-2xl border border-border/70 bg-card p-4 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-raised md:p-5"
          >
            <span className={`flex size-10 items-center justify-center rounded-xl ${tint}`}>
              <Icon className="size-5" />
            </span>
            <span className="flex items-center justify-between gap-2 text-sm font-medium">
              {label}
              <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
