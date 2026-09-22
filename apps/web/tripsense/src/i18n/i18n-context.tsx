"use client";

import * as React from "react";
import {
  LOCALES,
  DEFAULT_LOCALE,
  FALLBACK_LOCALE,
  LOCALE_STORAGE_KEY,
  type LocaleCode,
  type LocaleMeta,
} from "./config";

export interface I18nContextValue {
  locale: LocaleCode;
  setLocale: (locale: LocaleCode) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  availableLocales: LocaleMeta[];
}

const I18nContext = React.createContext<I18nContextValue | null>(null);

/**
 * Resolves a dot-notated key path (e.g., 'auth.welcomeTitle') within a translation tree.
 */
function resolvePath(obj: any, path: string): string | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const parts = path.split(".");
  let current: any = obj;

  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = current[part];
  }

  return typeof current === "string" ? current : undefined;
}

/**
 * Replaces {{variable}} placeholders with values from params object.
 */
function interpolate(
  template: string,
  params?: Record<string, string | number>,
): string {
  if (!params) return template;
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, paramName) => {
    return paramName in params ? String(params[paramName]) : match;
  });
}

export interface I18nProviderProps {
  children: React.ReactNode;
  initialLocale?: LocaleCode;
}

export function I18nProvider({ children, initialLocale }: I18nProviderProps) {
  const [locale, setLocaleState] = React.useState<LocaleCode>(
    initialLocale || DEFAULT_LOCALE,
  );

  // Initialize from localStorage safely on mount
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
      if (stored && LOCALES[stored]) {
        setLocaleState(stored);
      }
    } catch {
      // Ignore localStorage access errors (e.g. privacy mode)
    }
  }, []);

  const setLocale = React.useCallback((newLocale: LocaleCode) => {
    if (!LOCALES[newLocale]) {
      console.warn(`Locale '${newLocale}' is not registered in LOCALES.`);
      return;
    }
    setLocaleState(newLocale);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);
      document.documentElement.lang = newLocale;
    } catch {
      // Ignore
    }
  }, []);

  const t = React.useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const currentTranslations = LOCALES[locale]?.translations;
      let text = resolvePath(currentTranslations, key);

      // Fallback to FALLBACK_LOCALE if missing in current locale
      if (text === undefined && locale !== FALLBACK_LOCALE) {
        const fallbackTranslations = LOCALES[FALLBACK_LOCALE]?.translations;
        text = resolvePath(fallbackTranslations, key);
      }

      // If still missing, return the raw key
      if (text === undefined) {
        return key;
      }

      return interpolate(text, params);
    },
    [locale],
  );

  const availableLocales = React.useMemo(() => Object.values(LOCALES), []);

  const value = React.useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t,
      availableLocales,
    }),
    [locale, setLocale, t, availableLocales],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation(): I18nContextValue {
  const context = React.useContext(I18nContext);
  if (!context) {
    throw new Error("useTranslation must be used within an <I18nProvider />");
  }
  return context;
}
