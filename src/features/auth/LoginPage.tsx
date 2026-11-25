import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router-dom'
import { z } from 'zod'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { authErrorMessage } from './auth-errors'
import { BrandMark } from '@/components/layout/BrandMark'
import { useAuth } from './AuthProvider'

const schema = z.object({
  email: z.email(),
  password: z.string().min(8),
})
type FormValues = z.infer<typeof schema>

type Mode = 'signIn' | 'signUp'

export function LoginPage() {
  const { t } = useTranslation()
  const { session } = useAuth()
  const [mode, setMode] = useState<Mode>('signIn')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  if (session) return <Navigate to="/" replace />

  const onSubmit = async ({ email, password }: FormValues) => {
    setError(null)
    setInfo(null)
    if (mode === 'signIn') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(authErrorMessage(t, error, 'signIn'))
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      })
      if (error) setError(authErrorMessage(t, error, 'signUp'))
      // Email confirmation enabled → no session yet
      else if (!data.session) setInfo(t('auth.checkEmail'))
    }
  }

  const signInWithGoogle = async () => {
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) setError(authErrorMessage(t, error, 'signIn'))
  }

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center gap-6 overflow-hidden px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))]">
      {/* soft brand glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60rem_40rem_at_50%_-10%,rgb(38_144_207/0.16),transparent_60%),radial-gradient(40rem_30rem_at_100%_110%,rgb(11_86_164/0.10),transparent_60%)]"
      />
      <div className="absolute top-[calc(1rem+env(safe-area-inset-top))] right-4">
        <LanguageSwitcher />
      </div>
      <div className="flex flex-col items-center gap-3 text-center">
        <BrandMark className="size-14" />
        <div>
          <div className="text-3xl font-bold tracking-[0.08em]">{t('app.name')}</div>
          <div className="mt-1 text-sm text-muted-foreground">{t('app.tagline')}</div>
        </div>
      </div>
      <Card className="w-full max-w-sm gap-5 shadow-raised">
        <CardHeader>
          <CardTitle className="text-xl">
            {mode === 'signIn' ? t('auth.signInTitle') : t('auth.signUpTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!isSupabaseConfigured && (
            <Alert variant="destructive">
              <AlertDescription>{t('auth.errors.notConfigured')}</AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {info && (
            <Alert>
              <AlertDescription>{info}</AlertDescription>
            </Alert>
          )}
          <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="grid gap-2">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                aria-invalid={!!errors.email}
                {...register('email')}
              />
              {errors.email && <p className="text-sm text-destructive">{t('auth.errors.email')}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">{t('auth.password')}</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
                aria-invalid={!!errors.password}
                {...register('password')}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{t('auth.errors.password')}</p>
              )}
            </div>
            <Button type="submit" disabled={isSubmitting}>
              {mode === 'signIn' ? t('auth.signIn') : t('auth.signUp')}
            </Button>
          </form>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            {t('auth.or')}
            <div className="h-px flex-1 bg-border" />
          </div>
          <Button variant="outline" onClick={() => void signInWithGoogle()}>
            {t('auth.google')}
          </Button>
          <Button
            variant="link"
            onClick={() => {
              setMode(mode === 'signIn' ? 'signUp' : 'signIn')
              setError(null)
              setInfo(null)
            }}
          >
            {mode === 'signIn' ? t('auth.toSignUp') : t('auth.toSignIn')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
