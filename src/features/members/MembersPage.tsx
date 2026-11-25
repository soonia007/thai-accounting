import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/features/auth/AuthProvider'
import { canManageMembers, myCompaniesKey, useCompany } from '@/features/company/CompanyProvider'
import { supabase, type MemberRole } from '@/lib/supabase'

const ROLES: MemberRole[] = ['owner', 'admin', 'accountant', 'staff', 'viewer']
const INVITE_ROLES = ROLES.filter((r) => r !== 'owner')

const inviteSchema = z.object({
  email: z.email(),
  role: z.enum(['admin', 'accountant', 'staff', 'viewer']),
})
type InviteValues = z.infer<typeof inviteSchema>

function useMembers(companyId: string) {
  return useQuery({
    queryKey: ['members', companyId],
    queryFn: async () => {
      const { data: members, error } = await supabase
        .from('company_members')
        .select('user_id, role, created_at')
        .eq('company_id', companyId)
        .order('created_at')
      if (error) throw error
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in(
          'id',
          members.map((m) => m.user_id),
        )
      if (pErr) throw pErr
      const byId = new Map(profiles.map((p) => [p.id, p]))
      return members.map((m) => ({ ...m, profile: byId.get(m.user_id) }))
    },
  })
}

function useInvitations(companyId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['invitations', companyId],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_invitations')
        .select('id, email, role, expires_at')
        .eq('company_id', companyId)
        .is('accepted_at', null)
        .order('created_at')
      if (error) throw error
      return data
    },
  })
}

export function MembersPage() {
  const { t } = useTranslation()
  const { session } = useAuth()
  const { current } = useCompany()
  const queryClient = useQueryClient()
  const companyId = current!.id
  const canManage = canManageMembers(current?.role)
  const isOwner = current?.role === 'owner'

  const members = useMembers(companyId)
  const invitations = useInvitations(companyId, canManage)

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['members', companyId] }),
      queryClient.invalidateQueries({ queryKey: ['invitations', companyId] }),
      queryClient.invalidateQueries({ queryKey: myCompaniesKey(session?.user.id) }),
    ])

  const invite = useMutation({
    mutationFn: async (v: InviteValues) => {
      const { error } = await supabase
        .from('company_invitations')
        .insert({ company_id: companyId, email: v.email.toLowerCase(), role: v.role })
      if (error) throw error
    },
    onSuccess: async () => {
      reset({ email: '', role: 'staff' })
      await refresh()
    },
  })

  const changeRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: MemberRole }) => {
      const { error } = await supabase.rpc('update_member_role', {
        p_company_id: companyId,
        p_user_id: userId,
        p_role: role,
      })
      if (error) throw error
    },
    onSettled: refresh,
  })

  const remove = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc('remove_member', {
        p_company_id: companyId,
        p_user_id: userId,
      })
      if (error) throw error
    },
    onSettled: refresh,
  })

  const cancelInvite = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('company_invitations').delete().eq('id', id)
      if (error) throw error
    },
    onSettled: refresh,
  })

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors },
  } = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', role: 'staff' },
  })

  const inviteRole = useWatch({ control, name: 'role' })
  const actionError = invite.error ?? changeRole.error ?? remove.error ?? cancelInvite.error

  return (
    <div className="flex w-full flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight md:text-[28px]">{t('members.title')}</h1>

      {actionError && (
        <Alert variant="destructive">
          <AlertDescription>{actionError.message}</AlertDescription>
        </Alert>
      )}

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('members.invite')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
              noValidate
              onSubmit={handleSubmit((v) => invite.mutate(v))}
            >
              <div className="grid flex-1 gap-2">
                <Label htmlFor="invite-email">{t('auth.email')}</Label>
                <Input
                  id="invite-email"
                  type="email"
                  aria-invalid={!!errors.email}
                  {...register('email')}
                />
              </div>
              <div className="grid gap-2">
                <Label>{t('members.role')}</Label>
                <Select
                  value={inviteRole}
                  onValueChange={(v) => setValue('role', v as InviteValues['role'])}
                >
                  <SelectTrigger className="w-full sm:w-40" aria-label={t('members.role')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVITE_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {t(`roles.${r}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={invite.isPending}>
                {t('members.sendInvite')}
              </Button>
            </form>
            {errors.email && (
              <p className="mt-2 text-sm text-destructive">{t('auth.errors.email')}</p>
            )}
            <p className="mt-2 text-sm text-muted-foreground">{t('members.inviteHelp')}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('members.list')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y">
          {members.data?.map((m) => {
            const isMe = m.user_id === session?.user.id
            // Only owners may touch owners (DB enforces this too)
            const editable = canManage && (isOwner || m.role !== 'owner')
            return (
              <div key={m.user_id} className="flex flex-wrap items-center gap-2 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {m.profile?.full_name || m.profile?.email}
                    {isMe && (
                      <Badge variant="secondary" className="ml-2">
                        {t('members.you')}
                      </Badge>
                    )}
                  </div>
                  {m.profile?.full_name && (
                    <div className="truncate text-xs text-muted-foreground">{m.profile.email}</div>
                  )}
                </div>
                {editable ? (
                  <Select
                    value={m.role}
                    onValueChange={(role) =>
                      changeRole.mutate({ userId: m.user_id, role: role as MemberRole })
                    }
                  >
                    <SelectTrigger className="w-36" aria-label={t('members.role')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(isOwner ? ROLES : INVITE_ROLES).map((r) => (
                        <SelectItem key={r} value={r}>
                          {t(`roles.${r}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="outline">{t(`roles.${m.role}`)}</Badge>
                )}
                {(editable || isMe) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={isMe ? t('members.leave') : t('members.remove')}
                    title={isMe ? t('members.leave') : t('members.remove')}
                    onClick={() => {
                      const msg = isMe ? t('members.confirmLeave') : t('members.confirmRemove')
                      if (window.confirm(msg)) remove.mutate(m.user_id)
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      {canManage && (invitations.data?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('members.pending')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col divide-y">
            {invitations.data?.map((inv) => (
              <div key={inv.id} className="flex items-center gap-2 py-3">
                <span className="flex-1 truncate text-sm">{inv.email}</span>
                <Badge variant="outline">{t(`roles.${inv.role}`)}</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => cancelInvite.mutate(inv.id)}
                  disabled={cancelInvite.isPending}
                >
                  {t('common.cancel')}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
