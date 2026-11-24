import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/features/auth/AuthProvider'
import { supabase } from '@/lib/supabase'
import { myCompaniesKey, useCompany } from './CompanyProvider'

/** Open invitations addressed to the signed-in user's email (via RPC my_invitations). */
export function MyInvitations() {
  const { t } = useTranslation()
  const { session } = useAuth()
  const { switchCompany } = useCompany()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const email = session?.user.email?.toLowerCase()

  const { data: invitations = [] } = useQuery({
    queryKey: ['my-invitations', email],
    enabled: !!email,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_invitations')
      if (error) throw error
      return data
    },
  })

  const accept = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc('accept_invitation', { p_invitation_id: id })
      if (error) throw error
      return data
    },
    onSuccess: async (companyId) => {
      await queryClient.invalidateQueries({ queryKey: ['my-invitations'] })
      await queryClient.invalidateQueries({ queryKey: myCompaniesKey(session?.user.id) })
      switchCompany(companyId)
      navigate('/', { replace: true })
    },
  })

  if (invitations.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('invitations.title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {invitations.map((inv) => (
          <div key={inv.id} className="flex items-center justify-between gap-2">
            <span className="text-sm">
              {t('invitations.invitedAs', {
                company: inv.company_name,
                role: t(`roles.${inv.role}`),
              })}
            </span>
            <Button size="sm" disabled={accept.isPending} onClick={() => accept.mutate(inv.id)}>
              {t('invitations.accept')}
            </Button>
          </div>
        ))}
        {accept.error && <p className="text-sm text-destructive">{accept.error.message}</p>}
      </CardContent>
    </Card>
  )
}
