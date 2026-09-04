# Structured SEO implementation

The portfolio emits one JSON-LD graph per HTML page.

## Global structured data

Every page includes:

- `Person` for Albert Queraltó
- `WebSite` for the portfolio

Both entities use stable `@id` values (`/#person` and `/#website`) so project and
article schemas can reference them without duplicating identity data.

## Project pages

Every project page includes a `BreadcrumbList`. Payrithm and TenderWise also
include `SoftwareApplication` + `WebApplication` with their live/source URLs,
technology keywords, and a screenshot reference.

The flagship projects specify their own 1200x630 social card via `ogImage` in
project frontmatter. Other projects fall back to `/og/default.png` rather than
publishing misleading image dimensions for arbitrary screenshots.

## Blog posts

Every published post includes:

- `BlogPosting`
- `BreadcrumbList`
- publication and optional modification timestamps
- author/publisher references to the global `Person`
- article image, keywords, word count, and estimated reading time

## Social metadata

`Layout.astro` emits on every page:

- canonical URL
- `og:title`
- `og:description`
- `og:url`
- `og:type`
- `og:image`, dimensions, type, secure URL, and alt text
- `twitter:card=summary_large_image`
- Twitter title, description, URL, image, and image alt text

## Validation

Run:

```bash
npm run build
```

The build finishes with `scripts/check-seo.mjs`, which checks every generated
HTML page for the required canonical/Open Graph/Twitter tags and verifies the
expected JSON-LD types on flagship project and blog pages.

After deployment, also inspect representative URLs with Google's Rich Results
Test / Schema.org validator and refresh the LinkedIn cache with LinkedIn's Post
Inspector before sharing a newly changed URL.

## Google Software App rich-result note

The flagship app markup deliberately does **not** invent pricing or ratings.
Google's Software App rich-result rules require `offers.price` plus either an
`aggregateRating` or a `review`. Add those fields only when the corresponding
price/rating/review is real and visibly supported by the page. The current
`SoftwareApplication` markup remains valid Schema.org metadata even without
those Google-specific rich-result eligibility fields.
