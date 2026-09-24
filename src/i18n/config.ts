export const locales = ["en", "ca", "es", "de"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const localeNames: Record<Locale, string> = {
  en: "English",
  ca: "Català",
  es: "Español",
  de: "Deutsch",
};

export const localeShortNames: Record<Locale, string> = {
  en: "EN",
  ca: "CA",
  es: "ES",
  de: "DE",
};

export const openGraphLocales: Record<Locale, string> = {
  en: "en_GB",
  ca: "ca_ES",
  es: "es_ES",
  de: "de_DE",
};

export const dateLocales: Record<Locale, string> = {
  en: "en-GB",
  ca: "ca-ES",
  es: "es-ES",
  de: "de-DE",
};

export function isLocale(value: string | undefined | null): value is Locale {
  return Boolean(value && locales.includes(value as Locale));
}
