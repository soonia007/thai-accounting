import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, FileDown, Link2, Mail } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { dbErrorMessage } from '@/features/accounts/errors'
import { supabase } from '@/lib/supabase'
import { documentTitle, type PrintData } from './print-data'
import { downloadBlob, pdfFileName, renderPdf, shareUrl } from './render'

interface Props {
  documentId?: string
  paymentId?: string
  number: string | null
  posted: boolean
}

async function fetchPrintData(documentId?: string, paymentId?: string): Promise<PrintData> {
  const { data, error } = await supabase.rpc('print_document', {
    p_document_id: documentId,
    p_payment_id: paymentId,
  })
  if (error) throw error
  return data as unknown as PrintData
}

export function DocumentShareActions({ documentId, paymentId, number, posted }: Props) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [shareOpen, setShareOpen] = useState(false)
  const target = documentId ?? paymentId!

  const download = useMutation({
    mutationFn: async (copy: boolean) => {
      const data = await fetchPrintData(documentId, paymentId)
      downloadBlob(await renderPdf(data, copy), pdfFileName(data, copy))
    },
  })

  const links = useQuery({
    queryKey: ['share-links', target],
    enabled: shareOpen,
    queryFn: async () => {
      let q = supabase.from('document_shares').select('token, created_at, revoked_at, expires_at')
      q = documentId ? q.eq('document_id', documentId) : q.eq('payment_id', paymentId!)
      const { data, error } = await q
        .is('revoked_at', null)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const createLink = async () => {
    const { data, error } = await supabase.rpc('create_share_link', {
      p_document_id: documentId,
      p_payment_id: paymentId,
    })
    if (error) throw error
    await queryClient.invalidateQueries({ queryKey: ['share-links', target] })
    return data
  }
  const create = useMutation({ mutationFn: createLink })
  const revoke = useMutation({
    mutationFn: async (token: string) => {
      const { error } = await supabase.rpc('revoke_share_link', { p_token: token })
      if (error) throw error
      await queryClient.invalidateQueries({ queryKey: ['share-links', target] })
    },
  })

  // docs/DECISIONS.md P1: hand the PDF to the user's own share sheet / mail app
  const email = useMutation({
    mutationFn: async () => {
      const data = await fetchPrintData(documentId, paymentId)
      const blob = await renderPdf(data, false)
      const name = pdfFileName(data, false)
      const title = `${documentTitle(data).th} ${data.document.number ?? ''}`
      const file = new File([blob], name, { type: 'application/pdf' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title, text: title })
        return
      }
      const token = await createLink()
      downloadBlob(blob, name)
      const contactEmail = (data.contact as { email?: string | null } | null)?.email ?? ''
      const body = t('share.emailBody', {
        title,
        link: shareUrl(token),
        company: data.company.name,
      })
      window.location.href = `mailto:${encodeURIComponent(contactEmail)}?subject=${encodeURIComponent(
        `${title} — ${data.company.name}`,
      )}&body=${encodeURIComponent(body)}`
    },
  })

  const error = download.error ?? email.error
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={download.isPending}>
            <FileDown className="size-4" />
            {t('share.pdf')}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => download.mutate(false)}>
            {t('share.original')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => download.mutate(true)}>
            {t('share.copy')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {posted && (
        <>
          <Button variant="outline" size="sm" onClick={() => setShareOpen(true)}>
            <Link2 className="size-4" />
            {t('share.link')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={email.isPending}
            onClick={() => email.mutate()}
          >
            <Mail className="size-4" />
            {t('share.email')}
          </Button>
        </>
      )}
      {error && (
        <Alert variant="destructive" className="w-full">
          <AlertDescription>{dbErrorMessage(t, error)}</AlertDescription>
        </Alert>
      )}

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('share.linkTitle', { number })}</DialogTitle>
            <DialogDescription>{t('share.linkHelp')}</DialogDescription>
          </DialogHeader>
          {(create.error || revoke.error) && (
            <Alert variant="destructive">
              <AlertDescription>{dbErrorMessage(t, create.error ?? revoke.error)}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-col gap-2">
            {(links.data ?? []).map((l) => (
              <div key={l.token} className="flex items-center gap-2">
                <Input
                  readOnly
                  value={shareUrl(l.token)}
                  aria-label={t('share.link')}
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={t('share.copyLink')}
                  onClick={() => void navigator.clipboard.writeText(shareUrl(l.token))}
                >
                  <Copy className="size-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => revoke.mutate(l.token)}>
                  {t('share.revoke')}
                </Button>
              </div>
            ))}
            {links.data?.length === 0 && (
              <p className="text-sm text-muted-foreground">{t('share.noLinks')}</p>
            )}
            <Button
              className="self-start"
              disabled={create.isPending}
              onClick={() => create.mutate()}
            >
              {t('share.createLink')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
