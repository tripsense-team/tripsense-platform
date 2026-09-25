import { describe, it, expect } from "vitest";
import {
  LOCALES,
  DEFAULT_LOCALE,
  FALLBACK_LOCALE,
  LOCALE_STORAGE_KEY,
} from "../config";

function resolvePath(obj: unknown, path: string): string | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return typeof current === "string" ? current : undefined;
}

function interpolate(
  template: string,
  params?: Record<string, string | number>,
): string {
  if (!params) return template;
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, paramName) => {
    return paramName in params ? String(params[paramName]) : match;
  });
}

function translate(
  locale: string,
  key: string,
  params?: Record<string, string | number>,
): string {
  const currentTranslations = LOCALES[locale]?.translations;
  let text = resolvePath(currentTranslations, key);

  if (text === undefined && locale !== FALLBACK_LOCALE) {
    const fallbackTranslations = LOCALES[FALLBACK_LOCALE]?.translations;
    text = resolvePath(fallbackTranslations, key);
  }

  if (text === undefined) {
    return key;
  }

  return interpolate(text, params);
}

describe("i18n configuration and translation logic", () => {
  it("registers supported locales with metadata and translations", () => {
    expect(LOCALES.vi).toBeDefined();
    expect(LOCALES.vi.name).toBe("Tiếng Việt");
    expect(LOCALES.vi.flag).toBe("🇻🇳");

    expect(LOCALES.en).toBeDefined();
    expect(LOCALES.en.name).toBe("English");
    expect(LOCALES.en.flag).toBe("🇺🇸");

    expect(DEFAULT_LOCALE).toBe("vi");
    expect(FALLBACK_LOCALE).toBe("en");
    expect(LOCALE_STORAGE_KEY).toBe("tripsense-locale");
  });

  it("resolves nested keys accurately for both Vietnamese and English", () => {
    expect(translate("vi", "app.name")).toBe("TripSense");
    expect(translate("en", "app.name")).toBe("TripSense");

    expect(translate("vi", "auth.welcomeTitle")).toBe(
      "Chào mừng đến với TripSense",
    );
    expect(translate("en", "auth.welcomeTitle")).toBe("Welcome to TripSense");

    expect(translate("vi", "nav.explore")).toBe("Khám phá");
    expect(translate("en", "nav.explore")).toBe("Explore");
  });

  it("interpolates parameters inside {{placeholder}}", () => {
    const viResult = translate("vi", "auth.verificationCodeSent", {
      email: "hello@tripsense.app",
    });
    expect(viResult).toContain("hello@tripsense.app");

    const enResult = translate("en", "auth.verificationCodeSent", {
      email: "hello@tripsense.app",
    });
    expect(enResult).toContain("hello@tripsense.app");
  });

  it("falls back to English when key is missing in active locale", () => {
    // Simulate a locale that has missing keys
    const mockLocales = {
      ...LOCALES,
      testLang: {
        code: "testLang",
        name: "Test",
        flag: "🧪",
        translations: {
          app: { name: "TestApp" },
        },
      },
    };

    // key present in testLang
    expect(resolvePath(mockLocales.testLang.translations, "app.name")).toBe(
      "TestApp",
    );

    // key missing in testLang -> fallback to en
    const missingInTest = resolvePath(
      mockLocales.testLang.translations,
      "auth.loginSuccess",
    );
    expect(missingInTest).toBeUndefined();
    const fallbackToEn = resolvePath(
      LOCALES.en.translations,
      "auth.loginSuccess",
    );
    expect(fallbackToEn).toBe("Logged in successfully!");
  });

  it("returns raw key if not found in any locale", () => {
    expect(translate("vi", "non.existent.nested.key")).toBe(
      "non.existent.nested.key",
    );
    expect(translate("en", "another.missing.key")).toBe("another.missing.key");
  });
});
