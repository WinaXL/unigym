// src/stores/localeStore.ts
import { create } from 'zustand';
import i18n from '../core/i18n';
import type { SupportedLanguage } from '../core/i18n';

interface LocaleState {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
}

export const useLocaleStore = create<LocaleState>((set) => ({
  language: 'en',

  setLanguage: (lang) => {
    i18n.changeLanguage(lang);
    set({ language: lang });
  },
}));
