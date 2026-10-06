// src/core/i18n.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '../locales/en.json';
import ru from '../locales/ru.json';
import tr from '../locales/tr.json';
import kk from '../locales/kk.json';

export const SUPPORTED_LANGUAGES = ['en', 'ru', 'tr', 'kk'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** Each language's name in that language, so it is recognisable whatever is active. */
export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: 'English',
  ru: 'Русский',
  tr: 'Türkçe',
  kk: 'Қазақша',
};

export function isSupportedLanguage(value: string): value is SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

const resources = {
  en: { translation: en },
  ru: { translation: ru },
  tr: { translation: tr },
  kk: { translation: kk },
};

i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  compatibilityJSON: 'v4',
});

export default i18n;
