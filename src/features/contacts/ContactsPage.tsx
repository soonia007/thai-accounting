import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Plus, Search, Trash2, Upload, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ImportCsvDialog } from '@/components/ImportCsvDialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { dbErrorMessage } from '@/features/accounts/errors'
import { useCompany } from '@/features/company/CompanyProvider'
import { downloadCsv, toCsv } from '@/lib/csv'
import { canDeleteMasterData, canEditMasterData } from '@/lib/permissions'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { ContactDialog } from './ContactDialog'
import { ActionGroup, PageHeader } from '@/components/PageHeader'
import {
  CONTACT_COLUMNS,
  planContactImport,
  type Contact,
  type ContactImportRow,
} from './contact-csv'

type TypeFilter = 'all' | 'customer' | 'vendor'

export function ContactsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { current } = useCompany()
  const companyId = current!.id
  const canEdit = canEditMasterData(current?.role)
  const canDelete = canDeleteMasterData(current?.role)

  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [showInactive, setShowInactive] = useState(false)
  const [editing, setEditing] = useState<Contact | null | undefined>(undefined)
  const [importOpen, setImportOpen] = useState(false)

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contacts', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('company_id', companyId)
        .order('code')
      if (error) throw error
      return data
    },
  })

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return contacts.filter((c) => {
      if (!showInactive && !c.is_active) return false
      if (typeFilter !== 'all' && c.contact_type !== typeFilter && c.contact_type !== 'both')
        return false
      if (!q) return true
      return [c.code, c.name, c.tax_id ?? '', c.phone ?? '', c.contact_person ?? ''].some((v) =>
        v.toLowerCase().includes(q),
      )
    })
  }, [contacts, query, typeFilter, showInactive])

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error, count } = await supabase
        .from('contacts')
        .delete({ count: 'exact' })
        .eq('id', id)
      if (error) throw error
      if (count === 0) throw { code: '42501' }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['contacts', companyId] }),
  })

  const importRows = async (rows: ContactImportRow[]) => {
    const { error } = await supabase
      .from('contacts')
      // code is auto-assigned by the DB when null
      .upsert(
        rows.map((r) => ({ ...r, code: r.code as string, company_id: companyId })),
        { onConflict: 'company_id,code' },
      )
    if (error) throw error
    await queryClient.invalidateQueries({ queryKey: ['contacts', companyId] })
  }

  const exportCsv = () =>
    downloadCsv(
      `contacts-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(CONTACT_COLUMNS, contacts),
    )

  return (
    <div className="flex w-full flex-col gap-4">
      <PageHeader
        icon={Users}
        section={t('sections.data')}
        title={t('contacts.title')}
        description={t('pageInfo.contacts')}
        actions={
          <>
            <ActionGroup label={t('actionGroups.importExport')}>
              <Button variant="outline" size="sm" onClick={exportCsv}>
                <Download className="size-4" />
                {t('import.export')}
              </Button>
              {canEdit && (
                <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                  <Upload className="size-4" />
                  {t('import.import')}
                </Button>
              )}
            </ActionGroup>
            {canEdit && (
              <ActionGroup label={t('actionGroups.create')}>
                <Button size="sm" onClick={() => setEditing(null)}>
                  <Plus className="size-4" />
                  {t('contacts.add')}
                </Button>
              </ActionGroup>
            )}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder={t('contacts.search')}
            aria-label={t('contacts.search')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
          <SelectTrigger className="w-36" aria-label={t('contacts.contactType')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('contacts.filterAll')}</SelectItem>
            <SelectItem value="customer">{t('contacts.types.customer')}</SelectItem>
            <SelectItem value="vendor">{t('contacts.types.vendor')}</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Switch id="c-inactive" checked={showInactive} onCheckedChange={setShowInactive} />
          <Label htmlFor="c-inactive" className="text-sm">
            {t('common.showInactive')}
          </Label>
        </div>
      </div>

      {remove.error && (
        <Alert variant="destructive">
          <AlertDescription>{dbErrorMessage(t, remove.error)}</AlertDescription>
        </Alert>
      )}

      <Card className="gap-0 overflow-hidden py-0">
        {isLoading && <p className="p-4 text-sm text-muted-foreground">…</p>}
        {!isLoading && visible.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">
            {contacts.length === 0 ? t('contacts.empty') : t('common.noResults')}
          </p>
        )}
        <ul className="divide-y">
          {visible.map((c) => (
            <li
              key={c.id}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 text-sm',
                !c.is_active && 'text-muted-foreground',
              )}
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                onClick={() => setEditing(c)}
                aria-label={t('contacts.editNamed', { name: c.name })}
              >
                <span className="w-16 shrink-0 font-mono text-xs tabular-nums">{c.code}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{c.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {c.tax_id
                      ? `${c.tax_id} · ${c.branch_code === '00000' ? t('company.headOffice') : `${t('company.branchNo')} ${c.branch_code}`}`
                      : t('contacts.noTaxId')}
                    {c.phone ? ` · ${c.phone}` : ''}
                  </span>
                </span>
                <span className="hidden gap-1 sm:flex">
                  <Badge variant="secondary" className="font-normal">
                    {t(`contacts.types.${c.contact_type}`)}
                  </Badge>
                  {c.credit_term_days > 0 && (
                    <Badge variant="outline" className="font-normal">
                      {t('contacts.termDays', { days: c.credit_term_days })}
                    </Badge>
                  )}
                  {!c.is_active && (
                    <Badge variant="outline" className="font-normal">
                      {t('accounts.inactive')}
                    </Badge>
                  )}
                </span>
              </button>
              {canDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label={t('contacts.deleteNamed', { name: c.name })}
                  onClick={() => {
                    if (window.confirm(t('contacts.confirmDelete', { name: c.name })))
                      remove.mutate(c.id)
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Card>
      <p className="text-xs text-muted-foreground">
        {t('common.countOf', { shown: visible.length, total: contacts.length })}
      </p>

      <ContactDialog
        companyId={companyId}
        contact={editing}
        onClose={() => setEditing(undefined)}
      />
      <ImportCsvDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title={t('contacts.importTitle')}
        columns={CONTACT_COLUMNS}
        templateFilename="contacts-template.csv"
        plan={(headers, rows) => planContactImport(headers, rows, contacts)}
        onImport={importRows}
      />
    </div>
  )
}
