import { Capacitor } from '@capacitor/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Camera as CameraIcon, FileText, Paperclip, Trash2 } from 'lucide-react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { dbErrorMessage } from '@/features/accounts/errors'
import { useCompany } from '@/features/company/CompanyProvider'
import { canEditFinanceSetup, canEditMasterData } from '@/lib/permissions'
import { supabase } from '@/lib/supabase'
import { attachmentPath, MAX_ATTACHMENT_BYTES } from './path'

const BUCKET = 'attachments'

/** Bill photos / files attached to a document or payment (spec M6). */
export function AttachmentsPanel({
  documentId,
  paymentId,
}: {
  documentId?: string
  paymentId?: string
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { current } = useCompany()
  const companyId = current!.id
  const fileInput = useRef<HTMLInputElement>(null)
  const cameraInput = useRef<HTMLInputElement>(null)
  const key = ['attachments', documentId ?? paymentId]
  const canAdd = canEditMasterData(current?.role)
  const canDeleteAny = canEditFinanceSetup(current?.role)

  const list = useQuery({
    queryKey: key,
    queryFn: async () => {
      let q = supabase
        .from('attachments')
        .select('id, storage_path, file_name, mime_type, size_bytes, created_by, created_at')
      q = documentId ? q.eq('document_id', documentId) : q.eq('payment_id', paymentId!)
      const { data, error } = await q.order('created_at')
      if (error) throw error
      return data
    },
  })
  const me = useQuery({
    queryKey: ['me'],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
  })

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      for (const file of files) {
        if (file.size > MAX_ATTACHMENT_BYTES) throw new Error('ATTACHMENT_TOO_LARGE')
        const path = attachmentPath(companyId, file.name)
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { contentType: file.type || undefined })
        if (upErr) throw upErr
        const { error } = await supabase.from('attachments').insert({
          company_id: companyId,
          document_id: documentId ?? null,
          payment_id: paymentId ?? null,
          storage_path: path,
          file_name: file.name,
          mime_type: file.type || null,
          size_bytes: file.size,
        })
        if (error) {
          await supabase.storage.from(BUCKET).remove([path])
          throw error
        }
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })

  const remove = useMutation({
    mutationFn: async (a: { id: string; storage_path: string }) => {
      const { error } = await supabase.from('attachments').delete().eq('id', a.id)
      if (error) throw error
      await supabase.storage.from(BUCKET).remove([a.storage_path])
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })

  const open = async (path: string) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300)
    if (!error) window.open(data.signedUrl, '_blank', 'noopener')
  }

  // Native app: Capacitor Camera (camera or photo library); web: the browser's file/camera picker
  const takePhoto = async () => {
    if (!Capacitor.isNativePlatform()) {
      cameraInput.current?.click()
      return
    }
    const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera')
    const photo = await Camera.getPhoto({
      resultType: CameraResultType.Uri,
      source: CameraSource.Prompt,
      quality: 80,
      width: 2000,
    })
    if (!photo.webPath) return
    const blob = await (await fetch(photo.webPath)).blob()
    const name = `bill-${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}.${photo.format}`
    upload.mutate([new File([blob], name, { type: blob.type || `image/${photo.format}` })])
  }

  const onFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length) upload.mutate(files)
  }

  const error = upload.error ?? remove.error
  return (
    <Card className="py-4">
      <CardContent className="flex flex-col gap-3 px-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">{t('attachments.title')}</h2>
          {canAdd && (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={upload.isPending}
                onClick={() => void takePhoto()}
              >
                <CameraIcon className="size-4" />
                {t('attachments.takePhoto')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={upload.isPending}
                onClick={() => fileInput.current?.click()}
              >
                <Paperclip className="size-4" />
                {t('attachments.addFile')}
              </Button>
            </div>
          )}
          <input
            ref={fileInput}
            type="file"
            multiple
            accept="image/*,application/pdf"
            className="hidden"
            onChange={onFiles}
          />
          <input
            ref={cameraInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onFiles}
          />
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>
              {error.message === 'ATTACHMENT_TOO_LARGE'
                ? t('attachments.tooLarge')
                : dbErrorMessage(t, error)}
            </AlertDescription>
          </Alert>
        )}
        {upload.isPending && <p className="text-muted-foreground">{t('attachments.uploading')}</p>}
        {list.data?.length === 0 && !upload.isPending && (
          <p className="text-muted-foreground">{t('attachments.none')}</p>
        )}
        <ul className="flex flex-col gap-1">
          {(list.data ?? []).map((a) => (
            <li key={a.id} className="flex items-center gap-2 rounded-md border px-2 py-1.5">
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left text-primary underline"
                onClick={() => void open(a.storage_path)}
              >
                {a.file_name}
              </button>
              {(canDeleteAny || (canAdd && a.created_by === me.data)) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t('attachments.delete')}
                  disabled={remove.isPending}
                  onClick={() => {
                    if (window.confirm(t('attachments.confirmDelete', { name: a.file_name })))
                      remove.mutate(a)
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
