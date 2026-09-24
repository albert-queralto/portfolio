import { readFile } from "node:fs/promises";
import { access } from "node:fs/promises";

const locales = ["ca", "es", "de"];
const failures = [];

const config = await readFile("astro.config.mjs", "utf8");
const layout = await readFile("src/layouts/Layout.astro", "utf8");
const switcher = await readFile("src/components/LanguageSwitcher.astro", "utf8");
const schema = await readFile("src/content.config.ts", "utf8");

for (const locale of locales) {
  for (const path of [
    `src/pages/${locale}/index.astro`,
    `src/pages/${locale}/blog/index.astro`,
    `src/pages/${locale}/blog/[slug].astro`,
    `src/pages/${locale}/projects/[slug].astro`,
  ]) {
    try {
      await access(path);
    } catch {
      failures.push(`Missing localized route: ${path}`);
    }
  }
}

for (const needle of [
  'defaultLocale: "en"',
  'locales: ["en", "ca", "es", "de"]',
  'prefixDefaultLocale: false',
]) {
  if (!config.includes(needle)) failures.push(`astro.config.mjs missing ${needle}`);
}

if (!layout.includes("hreflang")) failures.push("Layout must emit hreflang alternates.");
if (!layout.includes("<html lang={locale}>")) failures.push("Layout must set the document language.");
if (!switcher.includes("localeNames")) failures.push("Language switcher is not wired to locale names.");
if (!schema.includes("translationKey")) failures.push("Content schema must support translationKey.");
if (!schema.includes("publishAt")) failures.push("Blog schema must keep publishAt support.");

if (failures.length) {
  console.error("i18n check failed:\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("i18n check passed: en/ca/es/de routes, metadata and content schema are configured.");
