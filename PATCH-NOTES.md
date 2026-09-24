# Portfolio i18n patch notes

Baseline used: `portfolio-with-analytics-events.zip`, the latest complete portfolio source archive available in the ChatGPT file library.

## What this patch adds

- English remains the unprefixed default locale.
- Catalan: `/ca/`
- Spanish: `/es/`
- German: `/de/`
- Localized home, navigation, experience, flagship projects, project grid, contact form, footer, blog index, project/article UI and 404 page.
- Language switcher that preserves the current logical path.
- Localized canonical URLs, `hreflang`, `x-default`, `<html lang>`, Open Graph locale and structured-data language.
- `lang` and `translationKey` content fields for gradual long-form translations.
- Safe English fallback for untranslated blog/project long-form content. Fallback detail pages are `noindex` and canonicalize to the real English source.
- `publishAt` support and filtering for scheduled blog publication.
- Existing English URLs remain unchanged.
- Blog index initially shows six articles and can expand the remaining posts.
- English RSS remains at `/rss.xml`; the custom sitemap emits all real localized pages and excludes future/draft content.
- New `npm run i18n:check` validation.
- `I18N.md` maintenance guide.

## Validation performed here

Passed:

```bash
node scripts/check-i18n.mjs
node scripts/check-consent.mjs
node scripts/check-analytics-events.mjs
node --check scripts/check-seo.mjs
```

The full Astro/TypeScript build could not be completed in this execution environment because the project dependencies were not available locally and dependency installation could not complete. After applying the patch, run:

```bash
npm ci
npm run check
npm run build
npm run format:check
```

If Prettier reports formatting-only changes, run `npm run format` and review the diff.

## Important baseline note

The patch is generated against the saved `portfolio-with-analytics-events.zip` baseline. It also reincorporates the later `publishAt` and blog "show more" behavior discussed in chat. If your live repository has additional edits that are not present in that saved archive, apply the patch on a branch and resolve any contextual conflicts rather than overwriting those edits.
