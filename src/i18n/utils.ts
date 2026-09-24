import { defaultLocale, isLocale, locales, type Locale } from "@/i18n/config";
import { messages } from "@/i18n/translations";

export function getLocale(value?: string | null): Locale {
  return isLocale(value) ? value : defaultLocale;
}

export type Messages = typeof messages.en;

export function getMessages(locale?: string | null): Messages {
  return messages[getLocale(locale)] as unknown as Messages;
}

export function stripLocalePrefix(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length > 0 && locales.includes(segments[0] as Locale) && segments[0] !== defaultLocale) {
    segments.shift();
  }
  return `/${segments.join("/")}${segments.length > 0 ? "/" : ""}`;
}

export function localizePath(locale: Locale, pathname = "/"): string {
  const path = stripLocalePrefix(pathname);
  if (locale === defaultLocale) return path;
  return path === "/" ? `/${locale}/` : `/${locale}${path}`;
}

export function localizedAbsoluteUrl(
  locale: Locale,
  pathname: string,
  base: URL | string,
): string {
  return new URL(localizePath(locale, pathname), base).toString();
}

export function contentLocale(data: { lang?: string | null }): Locale {
  return getLocale(data.lang);
}

export function contentTranslationKey(
  id: string,
  data: { translationKey?: string | null },
): string {
  if (data.translationKey) return data.translationKey;
  return id.replace(/^(en|ca|es|de)\//, "");
}

export function isPublished(
  data: { draft?: boolean; publishAt?: Date | null },
  now = new Date(),
): boolean {
  return !data.draft && (!data.publishAt || data.publishAt <= now);
}
