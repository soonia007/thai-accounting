import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import th from './locales/th.json'

export const SUPPORTED_LANGUAGES = ['th', 'en'] as const
export type Language = (typeof SUPPORTED_LANGUAGES)[number]

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { th: { translation: th }, en: { translation: en } },
    fallbackLng: 'th',
    supportedLngs: SUPPORTED_LANGUAGES,
    interpolation: { escapeValue: false },
    // Thai is the default; only remember an explicit user choice.
    detection: { order: ['localStorage'], caches: ['localStorage'] },
  })

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng
})

export default i18n
