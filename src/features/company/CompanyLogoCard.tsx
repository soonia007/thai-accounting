import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ImageUp, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { dbErrorMessage } from '@/features/accounts/errors'
import { useAuth } from '@/features/auth/AuthProvider'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { myCompaniesKey } from './CompanyProvider'
import { companyLogoUrl, LOGO_BUCKET, normalizeLogo } from './logo'

/**
 * Upload / replace / remove the company logo. It appears in the app (company switcher)
 * and on every document: PDFs, 50 Tawi certificates and the public share page.
 */
export function CompanyLogoCard({
  companyId,
  logoPath,
  canEdit,
}: {
  companyId: string
  logoPath: string | null
  canEdit: boolean
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const input = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const url = companyLogoUrl(logoPath)

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['company', companyId] })
    await queryClient.invalidateQueries({ queryKey: myCompaniesKey(session?.user.id) })
  }

  const setLogo = async (path: string | null) => {
    const { error } = await supabase
      .from('companies')
      .update({ logo_path: path })
      .eq('id', companyId)
    if (error) throw error
    // The previous file is no longer referenced; a failed clean-up only leaves an orphan
    if (logoPath && logoPath !== path) await supabase.storage.from(LOGO_BUCKET).remove([logoPath])
  }

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const png = await normalizeLogo(file)
      // A new name each time, so documents and browsers never show a cached old logo
      const path = `${companyId}/logo-${crypto.randomUUID()}.png`
      const { error } = await supabase.storage
        .from(LOGO_BUCKET)
        .upload(path, png, { contentType: 'image/png', cacheControl: '31536000' })
      if (error) throw error
      try {
        await setLogo(path)
      } catch (e) {
        await supabase.storage.from(LOGO_BUCKET).remove([path])
        throw e
      }
    },
    onSettled: refresh,
  })
  const remove = useMutation({ mutationFn: () => setLogo(null), onSettled: refresh })

  const pick = (files: FileList | null) => {
    const f = files?.[0]
    if (f) upload.mutate(f)
  }
  const error = upload.error ?? remove.error
  const message = (e: Error) =>
    e.message === 'LOGO_NOT_IMAGE' || e.message === 'LOGO_TOO_LARGE'
      ? t(`companyLogo.errors.${e.message}`)
      : dbErrorMessage(t, e)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('companyLogo.title')}</CardTitle>
        <CardDescription>{t('companyLogo.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{message(error)}</AlertDescription>
          </Alert>
        )}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <button
            type="button"
            disabled={!canEdit || upload.isPending}
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              if (canEdit) setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              if (canEdit) pick(e.dataTransfer.files)
            }}
            aria-label={t('companyLogo.upload')}
            className={cn(
              'flex h-32 w-full shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed bg-[repeating-conic-gradient(#f1f4f9_0_25%,#fff_0_50%)] bg-[length:16px_16px] p-3 transition-colors sm:w-64',
              canEdit && 'cursor-pointer hover:border-brand',
              dragOver && 'border-brand bg-accent',
            )}
          >
            {upload.isPending ? (
              <span className="text-sm text-muted-foreground">{t('companyLogo.uploading')}</span>
            ) : url ? (
              <img
                src={url}
                alt={t('companyLogo.title')}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <span className="flex flex-col items-center gap-1.5 text-sm text-muted-foreground">
                <ImageUp className="size-6 text-brand" />
                {canEdit ? t('companyLogo.drop') : t('companyLogo.none')}
              </span>
            )}
          </button>
          <div className="flex flex-col gap-2 text-sm text-muted-foreground">
            <p>{t('companyLogo.hint')}</p>
            {canEdit && (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={upload.isPending}
                  onClick={() => input.current?.click()}
                >
                  <ImageUp className="size-4" />
                  {url ? t('companyLogo.replace') : t('companyLogo.upload')}
                </Button>
                {url && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    disabled={remove.isPending}
                    onClick={() => {
                      if (window.confirm(t('companyLogo.confirmRemove'))) remove.mutate()
                    }}
                  >
                    <Trash2 className="size-4" />
                    {t('companyLogo.remove')}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={(e) => {
            pick(e.target.files)
            e.target.value = ''
          }}
        />
      </CardContent>
    </Card>
  )
}
