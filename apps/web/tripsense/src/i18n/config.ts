import en from "@/locales/en.json";
import vi from "@/locales/vi.json";

export type LocaleCode = "en" | "vi" | (string & {});

export interface LocaleMeta {
  code: LocaleCode;
  name: string;
  englishName?: string;
  flag: string;
  translations: Record<string, any>;
}

/**
 * Registry of supported locales in TripSense.
 * To support a new language, import its JSON file and add an entry here.
 */
export const LOCALES: Record<string, LocaleMeta> = {
  vi: {
    code: "vi",
    name: "Tiếng Việt",
    englishName: "Vietnamese",
    flag: "🇻🇳",
    translations: vi,
  },
  en: {
    code: "en",
    name: "English",
    englishName: "English (US)",
    flag: "🇺🇸",
    translations: en,
  },
};

export const DEFAULT_LOCALE: LocaleCode = "vi";
export const FALLBACK_LOCALE: LocaleCode = "en";
export const LOCALE_STORAGE_KEY = "tripsense-locale";
