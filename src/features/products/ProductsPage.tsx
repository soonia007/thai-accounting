import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Package, Plus, Search, Trash2, Upload } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ImportCsvDialog } from '@/components/ImportCsvDialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { dbErrorMessage } from '@/features/accounts/errors'
import { useAccounts } from '@/features/accounts/queries'
import { useCompany } from '@/features/company/CompanyProvider'
import { downloadCsv, toCsv } from '@/lib/csv'
import { canDeleteMasterData, canEditMasterData } from '@/lib/permissions'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { ProductDialog } from './ProductDialog'
import { ActionGroup, PageHeader } from '@/components/PageHeader'
import {
  PRODUCT_COLUMNS,
  planProductImport,
  productsToCsvRows,
  type Product,
  type ProductImportRow,
} from './product-csv'

const money = (n: number | null, lang: string) =>
  n === null
    ? '—'
    : n.toLocaleString(lang === 'en' ? 'en-US' : 'th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })

export function ProductsPage() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const { current } = useCompany()
  const companyId = current!.id
  const canEdit = canEditMasterData(current?.role)
  const canDelete = canDeleteMasterData(current?.role)

  const [query, setQuery] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [editing, setEditing] = useState<Product | null | undefined>(undefined)
  const [importOpen, setImportOpen] = useState(false)

  const { data: accounts = [] } = useAccounts(companyId)
  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('company_id', companyId)
        .order('code')
      if (error) throw error
      return data
    },
  })

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return products.filter(
      (p) =>
        (showInactive || p.is_active) &&
        (!q || [p.code, p.name, p.description ?? ''].some((v) => v.toLowerCase().includes(q))),
    )
  }, [products, query, showInactive])

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error, count } = await supabase
        .from('products')
        .delete({ count: 'exact' })
        .eq('id', id)
      if (error) throw error
      if (count === 0) throw { code: '42501' }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['products', companyId] }),
  })

  const importRows = async (rows: ProductImportRow[]) => {
    const { error } = await supabase.from('products').upsert(
      rows.map((r) => ({ ...r, code: r.code as string, company_id: companyId })),
      { onConflict: 'company_id,code' },
    )
    if (error) throw error
    await queryClient.invalidateQueries({ queryKey: ['products', companyId] })
  }

  const exportCsv = () =>
    downloadCsv(
      `products-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(PRODUCT_COLUMNS, productsToCsvRows(products, accounts)),
    )

  return (
    <div className="flex w-full flex-col gap-4">
      <PageHeader
        icon={Package}
        section={t('sections.data')}
        title={t('products.title')}
        description={t('pageInfo.products')}
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
                  {t('products.add')}
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
            placeholder={t('products.search')}
            aria-label={t('products.search')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch id="p-inactive" checked={showInactive} onCheckedChange={setShowInactive} />
          <Label htmlFor="p-inactive" className="text-sm">
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
            {products.length === 0 ? t('products.empty') : t('common.noResults')}
          </p>
        )}
        <ul className="divide-y">
          {visible.map((p) => (
            <li
              key={p.id}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 text-sm',
                !p.is_active && 'text-muted-foreground',
              )}
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                onClick={() => setEditing(p)}
                aria-label={t('products.editNamed', { name: p.name })}
              >
                <span className="w-16 shrink-0 font-mono text-xs tabular-nums">{p.code}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{p.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {t(`products.kinds.${p.kind}`)}
                    {p.unit ? ` · ${p.unit}` : ''}
                    {current?.vat_registered && p.vat_type !== 'standard'
                      ? ` · ${t(`products.vatTypes.${p.vat_type}`)}`
                      : ''}
                  </span>
                </span>
                <span className="w-28 shrink-0 text-right tabular-nums">
                  <span className="block">{money(p.sale_price, i18n.language)}</span>
                  <span className="block text-xs text-muted-foreground">
                    {t('products.buy')} {money(p.purchase_price, i18n.language)}
                  </span>
                </span>
                {!p.is_active && (
                  <Badge variant="outline" className="hidden font-normal sm:inline-flex">
                    {t('accounts.inactive')}
                  </Badge>
                )}
              </button>
              {canDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label={t('products.deleteNamed', { name: p.name })}
                  onClick={() => {
                    if (window.confirm(t('products.confirmDelete', { name: p.name })))
                      remove.mutate(p.id)
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
        {t('common.countOf', { shown: visible.length, total: products.length })}
      </p>

      <ProductDialog
        companyId={companyId}
        vatRegistered={current?.vat_registered ?? false}
        accounts={accounts}
        product={editing}
        onClose={() => setEditing(undefined)}
      />
      <ImportCsvDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title={t('products.importTitle')}
        columns={PRODUCT_COLUMNS}
        templateFilename="products-template.csv"
        plan={(headers, rows) => planProductImport(headers, rows, accounts)}
        onImport={importRows}
      />
    </div>
  )
}
