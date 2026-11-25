import { Check, ChevronsUpDown, LogOut, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/features/auth/AuthProvider'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { CompanyLogo } from './CompanyLogo'
import { useCompany } from './CompanyProvider'

export function CompanySwitcher({ className }: { className?: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { session } = useAuth()
  const { companies, current, switchCompany } = useCompany()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            'h-auto justify-between gap-2.5 rounded-xl px-2 py-1.5 hover:bg-muted',
            className,
          )}
          aria-label={t('company.switch')}
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <CompanyLogo name={current?.name} logoPath={current?.logo_path} />
            <span className="flex min-w-0 flex-col items-start leading-tight">
              <span className="max-w-full truncate text-sm font-semibold">{current?.name}</span>
              {current && (
                <span className="text-xs font-normal text-muted-foreground">
                  {t(`roles.${current.role}`)}
                </span>
              )}
            </span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
          {session?.user.email}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {companies.map((c) => (
          <DropdownMenuItem key={c.id} onSelect={() => switchCompany(c.id)}>
            <Check className={cn('size-4', c.id !== current?.id && 'invisible')} />
            <CompanyLogo
              name={c.name}
              logoPath={c.logo_path}
              className="size-6 rounded-md text-xs"
            />
            <span className="flex-1 truncate">{c.name}</span>
            <span className="text-xs text-muted-foreground">{t(`roles.${c.role}`)}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/onboarding')}>
          <Plus className="size-4" />
          {t('company.create')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void supabase.auth.signOut()}>
          <LogOut className="size-4" />
          {t('auth.signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
