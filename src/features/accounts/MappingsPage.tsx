import { Link2 } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCompany } from '@/features/company/CompanyProvider'
import { supabase } from '@/lib/supabase'
import { AccountingTabs } from './AccountingTabs'
import { dbErrorMessage } from './errors'
import { PageHeader } from '@/components/PageHeader'
import {
  ACCOUNT_ROLES,
  ROLE_ACCOUNT_TYPE,
  accountName,
  canEditAccounts,
  mappingsKey,
  useAccounts,
  useMappings,
  type AccountRole,
} from './queries'

export function MappingsPage() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const { current } = useCompany()
  const companyId = current!.id
  const canEdit = canEditAccounts(current?.role)

  const { data: accounts = [], isLoading: accountsLoading } = useAccounts(companyId)
  const { data: mappings, isLoading: mappingsLoading } = useMappings(companyId)
  const isLoading = accountsLoading || mappingsLoading

  const save = useMutation({
    mutationFn: async ({ role, accountId }: { role: AccountRole; accountId: string }) => {
      const { error } = await supabase
        .from('account_mappings')
        .upsert({ company_id: companyId, role, account_id: accountId })
      if (error) throw error
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: mappingsKey(companyId) }),
  })

  return (
    <div className="flex w-full flex-col gap-4">
      <PageHeader
        icon={Link2}
        section={t('nav.accounting')}
        title={t('mappings.title')}
        description={t('mappings.description')}
      />
      <AccountingTabs />

      {save.error && (
        <Alert variant="destructive">
          <AlertDescription>{dbErrorMessage(t, save.error)}</AlertDescription>
        </Alert>
      )}

      <Card className="py-0">
        <CardContent className="divide-y px-0">
          {isLoading && <p className="p-4 text-sm text-muted-foreground">…</p>}
          {!isLoading &&
            ACCOUNT_ROLES.map((role) => {
              const type = ROLE_ACCOUNT_TYPE[role]
              const mappedId = mappings?.get(role)
              const options = accounts.filter(
                (a) => a.type === type && !a.is_group && (a.is_active || a.id === mappedId),
              )
              return (
                <div
                  key={role}
                  className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{t(`accountRoles.${role}`)}</div>
                    <div className="text-xs text-muted-foreground">
                      {t(`mappings.help.${role}`)} · {t(`accountTypes.${type}`)}
                    </div>
                  </div>
                  <Select
                    value={mappedId ?? ''}
                    disabled={!canEdit || save.isPending}
                    onValueChange={(accountId) => save.mutate({ role, accountId })}
                  >
                    <SelectTrigger
                      className="w-full sm:w-80"
                      aria-label={t(`accountRoles.${role}`)}
                    >
                      <SelectValue placeholder={t('mappings.notMapped')} />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.code} {accountName(a, i18n.language)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )
            })}
        </CardContent>
      </Card>
    </div>
  )
}
