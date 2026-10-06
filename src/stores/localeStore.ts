// src/stores/localeStore.ts
import { create } from 'zustand';
import i18n from '../core/i18n';
import type { SupportedLanguage } from '../core/i18n';
import { storage } from '../services/storage';
import { STORAGE_KEYS } from '../core/constants';

interface LocaleState {
  language: SupportedLanguage;
  /** Switch the UI language now and remember it for the next launch. */
  setLanguage: (lang: SupportedLanguage) => void;
  /** Apply a language restored from storage, without writing it back. */
  hydrateLanguage: (lang: SupportedLanguage) => void;
}

export const useLocaleStore = create<LocaleState>((set) => ({
  language: 'en',

  setLanguage: (lang) => {
    void i18n.changeLanguage(lang);
    set({ language: lang });
    // A failed write only means the choice is not remembered; the switch itself
    // has already happened, so there is nothing to roll back.
    storage.setItem(STORAGE_KEYS.LANGUAGE, lang).catch(() => {});
  },

  hydrateLanguage: (lang) => {
    void i18n.changeLanguage(lang);
    set({ language: lang });
  },
}));
