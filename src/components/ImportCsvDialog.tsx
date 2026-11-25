import { useMutation } from '@tanstack/react-query'
import { Download, Upload } from 'lucide-react'
import { useState } from 'react'
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
import { dbErrorMessage } from '@/features/accounts/errors'
import { downloadCsv, parseCsv, toCsv, type CsvRow, type ImportPlan } from '@/lib/csv'

interface Props<T> {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  columns: readonly string[]
  templateFilename: string
  plan: (headers: string[], rows: CsvRow[]) => ImportPlan<T>
  onImport: (rows: T[]) => Promise<void>
}

const MAX_ERRORS_SHOWN = 50

export function ImportCsvDialog<T>({
  open,
  onOpenChange,
  title,
  columns,
  templateFilename,
  plan,
  onImport,
}: Props<T>) {
  const { t } = useTranslation()
  const [fileName, setFileName] = useState<string | null>(null)
  const [result, setResult] = useState<ImportPlan<T> | null>(null)
  const [done, setDone] = useState<number | null>(null)

  const reset = () => {
    setFileName(null)
    setResult(null)
    setDone(null)
    run.reset()
  }

  const run = useMutation({
    mutationFn: async (rows: T[]) => {
      await onImport(rows)
      return rows.length
    },
    onSuccess: (n) => {
      setDone(n)
      setResult(null)
    },
  })

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setDone(null)
    run.reset()
    setFileName(file.name)
    const { headers, rows } = parseCsv(await file.text())
    setResult(plan(headers, rows))
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset()
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t('import.help')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadCsv(templateFilename, toCsv(columns, []))}
          >
            <Download className="size-4" />
            {t('import.template')}
          </Button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-1.5 text-sm hover:bg-accent">
            <Upload className="size-4" />
            {fileName ?? t('import.chooseFile')}
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => {
                void onFile(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </label>
        </div>

        {done !== null && (
          <Alert>
            <AlertDescription>{t('import.done', { count: done })}</AlertDescription>
          </Alert>
        )}
        {run.error && (
          <Alert variant="destructive">
            <AlertDescription>{dbErrorMessage(t, run.error)}</AlertDescription>
          </Alert>
        )}

        {result && result.missingColumns.length > 0 && (
          <Alert variant="destructive">
            <AlertDescription>
              {t('import.missingColumns', { columns: result.missingColumns.join(', ') })}
            </AlertDescription>
          </Alert>
        )}

        {result && result.missingColumns.length === 0 && (
          <div className="flex flex-col gap-2 text-sm">
            <p>
              {t('import.summary', { valid: result.valid.length, errors: result.errors.length })}
            </p>
            {result.errors.length > 0 && (
              <div className="max-h-60 overflow-auto rounded-xl border">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="px-2 py-1">{t('import.row')}</th>
                      <th className="px-2 py-1">{t('import.column')}</th>
                      <th className="px-2 py-1">{t('import.problem')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.slice(0, MAX_ERRORS_SHOWN).map((e, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-2 py-1 tabular-nums">{e.row}</td>
                        <td className="px-2 py-1 font-mono">{e.field}</td>
                        <td className="px-2 py-1">{t(`import.errors.${e.code}`)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {result.errors.length > 0 && result.valid.length > 0 && (
              <p className="text-muted-foreground">{t('import.partialNote')}</p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {done !== null ? t('common.close') : t('common.cancel')}
          </Button>
          {result && result.valid.length > 0 && (
            <Button disabled={run.isPending} onClick={() => run.mutate(result.valid)}>
              {t('import.importN', { count: result.valid.length })}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
