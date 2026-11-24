import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router-dom'
import { z } from 'zod'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
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
      if (error) setError(t('auth.errors.invalidLogin'))
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      })
      if (error) setError(error.message)
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
    if (error) setError(error.message)
  }

  return (
    <div className="pt-safe pb-safe flex min-h-dvh flex-col items-center justify-center gap-4 p-4">
      <div className="flex w-full max-w-sm justify-end">
        <LanguageSwitcher />
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">{t('app.name')}</CardTitle>
          <CardDescription>
            {mode === 'signIn' ? t('auth.signInTitle') : t('auth.signUpTitle')}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
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
