# Albert Queraltó — Portfolio

A fast, accessible portfolio for **Albert Queraltó, PhD**, focused on production data science, machine-learning engineering, and software development.

## Highlights

- Clear positioning around applied ML systems, time-series modelling, anomaly detection, data pipelines, and Python services.
- Filterable project catalogue with source and live-demo links.
- Technical blog built with Astro Content Collections, Markdown, KaTeX, and reading-time metadata.
- Accessible keyboard interactions, visible form labels, reduced-motion support, and theme persistence.
- SEO essentials: canonical URLs, structured data, Open Graph metadata, robots rules, and a generated sitemap.
- Production deployment with a multi-stage Docker build, Nginx caching/security headers, TLS reverse proxy, and health checks.

## Stack

- Astro 5
- React 19
- TypeScript
- Tailwind CSS
- Docker and Nginx

## Local development

```bash
npm ci
npm run dev
```

Open `http://localhost:4321`.

## Quality checks

```bash
npm run build
```

The build script runs `astro check` before generating the static site.

## Production deployment

```bash
docker compose build --pull
docker compose up -d
```

The `portfolio` container serves the generated site internally. The `reverse-proxy` container is the only service that publishes ports 80 and 443.

The TLS configuration expects certificates under:

```text
./certbot/conf/live/albertqueralto.dev/
```

Create or expand the shared Let's Encrypt certificate for the configured
domains with:

```bash
scripts/issue-letsencrypt-cert.sh standalone
```

Use `standalone` for the first certificate. Once nginx can already start with an
existing certificate, use:

```bash
scripts/issue-letsencrypt-cert.sh webroot
```

## Content locations

- Homepage sections: `src/components/`
- Projects: `src/components/projects.astro`
- Blog posts: `src/content/blog/`
- Site identity and links: `src/data/site.ts`
- Public assets and CV: `public/`

## Licence

See [LICENSE](LICENSE).
