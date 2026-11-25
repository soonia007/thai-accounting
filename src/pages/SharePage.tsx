import { useMutation, useQuery } from '@tanstack/react-query'
import { FileDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { documentTitle, type PrintData } from '@/features/pdf/print-data'
import { downloadBlob, pdfFileName, renderPdf } from '@/features/pdf/render'
import { formatDate, formatMoney } from '@/lib/format'
import { CompanyLogo } from '@/features/company/CompanyLogo'
import { supabase } from '@/lib/supabase'

/** Public, read-only page behind a share link (docs/DECISIONS.md P2). No sign-in needed. */
export function SharePage() {
  const { t } = useTranslation()
  const { token } = useParams()
  const { data, isLoading } = useQuery({
    queryKey: ['shared', token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_shared_document', { p_token: token! })
      if (error) throw error
      return data as unknown as PrintData | null
    },
  })
  const download = useMutation({
    mutationFn: async (copy: boolean) => {
      downloadBlob(await renderPdf(data!, copy), pdfFileName(data!, copy))
    },
  })

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col gap-4 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div className="flex justify-end">
        <LanguageSwitcher />
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">…</p>}
      {!isLoading && !data && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            {t('share.invalid')}
          </CardContent>
        </Card>
      )}
      {data && (
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <CompanyLogo
              name={data.company.name}
              logoPath={data.company.logo_path}
              wide
              className="h-12 rounded-xl"
            />
            <div className="min-w-0">
              <CardTitle>
                {documentTitle(data).th} {data.document.number}
              </CardTitle>
              <p className="text-sm text-muted-foreground">{data.company.name}</p>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            <dl className="grid grid-cols-2 gap-y-1">
              <dt className="text-muted-foreground">{t('docs.date')}</dt>
              <dd>
                {formatDate(
                  data.document.kind === 'payment'
                    ? data.document.pay_date
                    : data.document.doc_date,
                  data.company.date_era,
                )}
              </dd>
              {data.contact && (
                <>
                  <dt className="text-muted-foreground">{t('docs.customer')}</dt>
                  <dd>{data.contact.name}</dd>
                </>
              )}
              <dt className="text-muted-foreground">{t('totals.total')}</dt>
              <dd className="font-semibold">
                {formatMoney(
                  data.document.kind === 'payment'
                    ? Number(data.document.amount) + Number(data.document.wht_amount)
                    : data.document.total,
                )}
              </dd>
            </dl>
            <div className="flex gap-2">
              <Button disabled={download.isPending} onClick={() => download.mutate(false)}>
                <FileDown className="size-4" />
                {t('share.original')}
              </Button>
              <Button
                variant="outline"
                disabled={download.isPending}
                onClick={() => download.mutate(true)}
              >
                {t('share.copy')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
