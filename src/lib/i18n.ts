// i18n setup. Scope (2026-05-18): sub portal + public pages only.
// Admin + Principal portals stay English for now - they'll get the
// switcher in a later phase.
//
// Locale precedence on first paint:
//   1. localStorage key `nexora_locale` (set by LocaleSwitcher).
//   2. preferred_locale from /auth/me (we set it via setLocale() once
//      the auth bootstrap finishes - see auth provider).
//   3. browser default (navigator.language) - if it starts with "ro"
//      we default to ro, otherwise en.
//
// Adding a new key: edit BOTH en + ro JSON below. Falling back to EN
// when ro is missing is the default i18next behaviour; that means
// "untranslated" strings still render in English instead of showing
// the raw key.

import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import ro from "./locales/ro.json";

export const SUPPORTED_LOCALES = ["en", "ro"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { common: en },
      ro: { common: ro },
    },
    fallbackLng: "en",
    supportedLngs: SUPPORTED_LOCALES as unknown as string[],
    defaultNS: "common",
    interpolation: {
      // React already escapes everything before it reaches the DOM,
      // so we don't need i18next to escape again. Saves a pass and
      // keeps interpolated values readable.
      escapeValue: false,
    },
    detection: {
      // Use our own localStorage key so we don't collide with any
      // other library that ships its own i18n.
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "nexora_locale",
      caches: ["localStorage"],
    },
  });

/** Set the active locale + persist to localStorage. */
export function setLocale(locale: SupportedLocale) {
  i18n.changeLanguage(locale);
  try { window.localStorage.setItem("nexora_locale", locale); } catch { /* private mode */ }
}

/** Read the current active locale (use this outside React components). */
export function getLocale(): SupportedLocale {
  const l = i18n.language?.slice(0, 2);
  return (SUPPORTED_LOCALES as readonly string[]).includes(l) ? (l as SupportedLocale) : "en";
}

export default i18n;
