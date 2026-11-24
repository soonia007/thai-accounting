import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { isSupabaseConfigured } from '@/lib/supabase'

export function HelloPage() {
  const { t } = useTranslation()
  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="text-2xl">{t('hello.title')}</CardTitle>
        <CardDescription>{t('hello.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm">
        {t('hello.supabase')}:{' '}
        <span className={isSupabaseConfigured ? 'text-green-600' : 'text-amber-600'}>
          {isSupabaseConfigured ? t('hello.configured') : t('hello.notConfigured')}
        </span>
      </CardContent>
    </Card>
  )
}
