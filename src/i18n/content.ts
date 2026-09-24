import { getCollection, type CollectionEntry } from "astro:content";
import type { Locale } from "@/i18n/config";
import { contentLocale, contentTranslationKey, isPublished } from "@/i18n/utils";

export interface LocalizedEntry<T> {
  key: string;
  entry: T;
  fallback: boolean;
}

function chooseLocalized<T extends { id: string; data: { lang?: string; translationKey?: string } }>(
  entries: T[],
  locale: Locale,
): LocalizedEntry<T>[] {
  const grouped = new Map<string, T[]>();
  for (const entry of entries) {
    const key = contentTranslationKey(entry.id, entry.data);
    grouped.set(key, [...(grouped.get(key) ?? []), entry]);
  }

  return [...grouped.entries()].map(([key, group]) => {
    const localized = group.find((entry) => contentLocale(entry.data) === locale);
    const english = group.find((entry) => contentLocale(entry.data) === "en");
    const entry = localized ?? english ?? group[0];
    return { key, entry, fallback: contentLocale(entry.data) !== locale };
  });
}

export async function getPublishedBlogEntries(now = new Date()) {
  return getCollection("blog", ({ data }) => isPublished(data, now));
}

export async function getLocalizedBlogEntries(locale: Locale, now = new Date()) {
  const entries = await getPublishedBlogEntries(now);
  return chooseLocalized(entries, locale).sort(
    (a, b) => b.entry.data.date.valueOf() - a.entry.data.date.valueOf(),
  );
}

export async function getLocalizedProjectEntries(locale: Locale) {
  const entries = await getCollection("projects", ({ data }) => !data.draft);
  return chooseLocalized(entries, locale).sort(
    (a, b) => a.entry.data.order - b.entry.data.order,
  );
}

export async function getBlogByKey(key: string, locale: Locale, now = new Date()) {
  const entries = await getPublishedBlogEntries(now);
  const group = entries.filter((entry) => contentTranslationKey(entry.id, entry.data) === key);
  const localized = group.find((entry) => contentLocale(entry.data) === locale);
  const english = group.find((entry) => contentLocale(entry.data) === "en");
  const entry = localized ?? english;
  if (!entry) return null;
  return { key, entry, fallback: contentLocale(entry.data) !== locale, group };
}

export async function getProjectByKey(key: string, locale: Locale) {
  const entries = await getCollection("projects", ({ data }) => !data.draft);
  const group = entries.filter((entry) => contentTranslationKey(entry.id, entry.data) === key);
  const localized = group.find((entry) => contentLocale(entry.data) === locale);
  const english = group.find((entry) => contentLocale(entry.data) === "en");
  const entry = localized ?? english;
  if (!entry) return null;
  return { key, entry, fallback: contentLocale(entry.data) !== locale, group };
}

export function availableLocales<T extends { data: { lang?: string } }>(entries: T[]): Locale[] {
  const values = new Set(entries.map((entry) => contentLocale(entry.data)));
  return [...values];
}

export type BlogEntry = CollectionEntry<"blog">;
export type ProjectEntry = CollectionEntry<"projects">;
