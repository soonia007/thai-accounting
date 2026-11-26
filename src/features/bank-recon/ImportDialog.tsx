import { FileSpreadsheet, Upload } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { dbErrorMessage } from '@/features/accounts/errors'
import { formatDate, formatMoney, type DateEra } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  guessMapping,
  readStatementFile,
  toLines,
  type ColumnMapping,
  type SheetData,
} from './parse'
import { useImportStatement } from './queries'

/**
 * Two steps: choose the file → check the columns (remembered for this bank next time) with a live
 * preview of how the lines will be read → import.
 */
export function ImportDialog({
  open,
  onOpenChange,
  bankId,
  savedMapping,
  era,
  onDone,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  bankId: string
  savedMapping: ColumnMapping | null
  era: DateEra
  onDone: (msg: string) => void
}) {
  const { t, i18n } = useTranslation()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [sheet, setSheet] = useState<SheetData | null>(null)
  const [map, setMap] = useState<ColumnMapping | null>(null)
  const [readError, setReadError] = useState<string | null>(null)
  const imp = useImportStatement(bankId)
  const parsed = useMemo(() => (sheet && map ? toLines(sheet, map) : null), [sheet, map])

  const reset = () => {
    setFile(null)
    setSheet(null)
    setMap(null)
    setReadError(null)
    imp.reset()
  }
  const pick = async (f: File) => {
    setReadError(null)
    try {
      const s = await readStatementFile(f)
      if (!s.headers.length) throw new Error('empty')
      setFile(f)
      setSheet(s)
      // the saved mapping only if its columns exist in this file
      const ok = savedMapping && s.headers.includes(savedMapping.date)
      setMap(ok ? savedMapping : guessMapping(s.headers))
    } catch {
      setReadError(t('bankRecon.import.readError'))
    }
  }

  const field = (k: keyof ColumnMapping, optional = true) =>
    sheet &&
    map && (
      <div className="grid gap-1.5">
        <Label htmlFor={`m-${k}`}>{t(`bankRecon.import.fields.${k}`)}</Label>
        <select
          id={`m-${k}`}
          className="h-9 rounded-xl border bg-card pr-9 pl-3 text-sm"
          value={(map[k] as string | undefined) ?? ''}
          onChange={(e) => setMap({ ...map, [k]: e.target.value || undefined })}
        >
          {optional && <option value="">{t('bankRecon.import.none')}</option>}
          {sheet.headers.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
      </div>
    )

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset()
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('bankRecon.import.title')}</DialogTitle>
          <DialogDescription>
            {sheet ? t('bankRecon.import.step2') : t('bankRecon.import.step1')}
          </DialogDescription>
        </DialogHeader>

        {!sheet && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const f = e.dataTransfer.files[0]
              if (f) void pick(f)
            }}
            className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center transition-colors hover:border-brand hover:bg-accent/40"
          >
            <span className="flex size-12 items-center justify-center rounded-2xl bg-accent text-brand">
              <Upload className="size-6" />
            </span>
            <span className="font-medium">{t('bankRecon.import.drop')}</span>
            <span className="text-xs text-muted-foreground">{t('bankRecon.import.formats')}</span>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void pick(f)
                e.target.value = ''
              }}
            />
          </button>
        )}
        {readError && (
          <Alert variant="destructive">
            <AlertDescription>{readError}</AlertDescription>
          </Alert>
        )}

        {sheet && map && parsed && (
          <div className="flex flex-col gap-4">
            <p className="flex items-center gap-2 text-sm">
              <FileSpreadsheet className="size-4 text-brand" />
              <span className="font-medium">{file?.name}</span>
              <Button variant="ghost" size="sm" onClick={reset}>
                {t('bankRecon.import.otherFile')}
              </Button>
            </p>
            <div className="grid gap-3 rounded-2xl border p-4 sm:grid-cols-3">
              {field('date', false)}
              <div className="grid gap-1.5">
                <Label htmlFor="m-order">{t('bankRecon.import.fields.dateOrder')}</Label>
                <select
                  id="m-order"
                  className="h-9 rounded-xl border bg-card pr-9 pl-3 text-sm"
                  value={map.dateOrder}
                  onChange={(e) =>
                    setMap({ ...map, dateOrder: e.target.value as ColumnMapping['dateOrder'] })
                  }
                >
                  <option value="dmy">31/12/2026 (วัน/เดือน/ปี)</option>
                  <option value="mdy">12/31/2026 (month/day/year)</option>
                  <option value="ymd">2026-12-31</option>
                </select>
              </div>
              {field('description')}
              {field('reference')}
              {field('amount')}
              {field('balance')}
              {field('withdrawal')}
              {field('deposit')}
              <p className="text-xs text-muted-foreground sm:col-span-3">
                {t('bankRecon.import.moneyHint')}
              </p>
            </div>

            <div className="overflow-hidden rounded-2xl border">
              <div className="flex items-center justify-between bg-muted/60 px-3 py-2 text-xs">
                <span className="font-medium">
                  {t('bankRecon.import.preview', { count: parsed.lines.length })}
                </span>
                {parsed.skipped.length > 0 && (
                  <span className="text-warning-foreground">
                    {t('bankRecon.import.skippedRows', {
                      rows: parsed.skipped.slice(0, 8).join(', '),
                    })}
                  </span>
                )}
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {parsed.lines.slice(0, 6).map((l, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        {formatDate(l.txn_date, era)}
                      </td>
                      <td className="px-3 py-1.5">{l.description}</td>
                      <td
                        className={cn(
                          'px-3 py-1.5 text-right tabular-nums',
                          l.amount < 0 ? 'text-destructive' : 'text-success-foreground',
                        )}
                      >
                        {l.amount > 0 ? '+' : ''}
                        {formatMoney(l.amount, i18n.language)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {imp.error != null && (
              <Alert variant="destructive">
                <AlertDescription>{dbErrorMessage(t, imp.error)}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={!parsed || parsed.lines.length === 0 || imp.isPending}
            onClick={() =>
              parsed &&
              map &&
              imp.mutate(
                { fileName: file?.name ?? '', lines: parsed.lines, mapping: map },
                {
                  onSuccess: (r) => {
                    onDone(t('bankRecon.import.done', { inserted: r.inserted, skipped: r.skipped }))
                    reset()
                    onOpenChange(false)
                  },
                },
              )
            }
          >
            {t('bankRecon.import.submit', { count: parsed?.lines.length ?? 0 })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
