import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft, FileDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useCompany } from '@/features/company/CompanyProvider'
import { formatDate, formatMoney } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import { downloadWhtCertificate } from './render'

/** All 50 ทวิ certificates issued by the company, newest first. */
export function WhtCertificatesPage() {
  const { t, i18n } = useTranslation()
  const { current } = useCompany()
  const companyId = current!.id
  const certs = useQuery({
    queryKey: ['wht-certificates', 'company', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wht_certificates')
        .select(
          'id, number, cert_date, form, condition, total_income, total_tax, voided_at, payment_id, document_id, contacts (name)',
        )
        .eq('company_id', companyId)
        .order('cert_date', { ascending: false })
        .order('number', { ascending: false })
      if (error) throw error
      return data
    },
  })
  const download = useMutation({ mutationFn: downloadWhtCertificate })

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild aria-label={t('common.back')}>
          <Link to="/purchases">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight md:text-[28px]">
          {t('wht.certificates')}
        </h1>
      </div>
      {certs.data?.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('wht.noCertificates')}</p>
      )}
      <ul className="flex flex-col gap-2">
        {(certs.data ?? []).map((c) => (
          <li
            key={c.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border bg-card p-3 text-sm"
          >
            <span className="font-mono text-xs">{c.number}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate">{c.contacts?.name}</div>
              <div className="text-xs text-muted-foreground">
                {formatDate(c.cert_date, current!.date_era)} · {t(`wht.forms.${c.form}`)} ·{' '}
                {t(`wht.conditions.${c.condition}`)}
              </div>
            </div>
            {c.voided_at && (
              <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive-foreground">
                {t('docStatus.voided')}
              </span>
            )}
            <div className="text-right">
              <div className="tabular-nums">{formatMoney(c.total_tax, i18n.language)}</div>
              <div className="text-xs text-muted-foreground tabular-nums">
                {t('wht.income')} {formatMoney(c.total_income, i18n.language)}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={download.isPending}
              onClick={() => download.mutate(c.id)}
            >
              <FileDown className="size-4" />
              PDF
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
