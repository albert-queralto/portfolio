# Portfolio improvement notes

## What changed

- Reframed the landing page around a clear data-science and software-engineering value proposition.
- Replaced generic capability claims with evidence drawn from the CV and real project work.
- Improved project cards with clearer problems, technical focus, and source/live links.
- Fixed broken CV markup and outdated Vercel/custom-domain metadata.
- Added canonical URLs, Open Graph/Twitter metadata, structured data, robots.txt, and a generated sitemap.
- Added a custom 404 page and stronger Docker/Nginx production defaults.
- Improved keyboard navigation, focus states, form labels/status messages, filter semantics, and reduced-motion behavior.
- Made the animated hero more efficient with resize, visibility, device-pixel-ratio, and cleanup handling.
- Standardized the project on npm and removed an unused dependency.

## Recommended next upgrades

1. Replace project screenshots with consistent 16:10 images and add one concise outcome metric per project.
2. Add a professional headshot only when it supports the desired personal brand; the current visual-first hero also works well without one.
3. Publish two or three case-study posts that show the problem, data constraints, approach, validation, and deployment decisions.
4. Add privacy-friendly analytics only after defining the conversion events worth measuring, such as CV opens and project clicks.
5. Run Lighthouse and real-device testing after deploying to the production domain, then tune based on measured results.

## Local verification

```bash
npm ci
npm run build
npm run preview
```

The build command performs Astro's type/content checks before producing the static site.
