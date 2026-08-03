#!/usr/bin/env python3
"""Apply canonical URL and indexing consistency fixes to the portfolio.

Run this file from the root of albert-queralto/portfolio:

    python3 apply-seo-indexing-fix.py

All checks run before any file is written, so a source mismatch cannot leave a
partially edited repository.
"""

from __future__ import annotations

from pathlib import Path
import sys


ROOT = Path.cwd()
pending: dict[Path, str] = {}
status: dict[Path, str] = {}


def read_source(path: str) -> tuple[Path, str]:
    file_path = ROOT / path
    if file_path in pending:
        return file_path, pending[file_path]
    if not file_path.exists():
        raise RuntimeError(f"Missing expected file: {path}")
    return file_path, file_path.read_text(encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    file_path, content = read_source(path)

    if new in content:
        status.setdefault(file_path, "already fixed")
        return

    count = content.count(old)
    if count != 1:
        raise RuntimeError(
            f"{path}: expected exactly one matching source block, found {count}"
        )

    pending[file_path] = content.replace(old, new, 1)
    status[file_path] = "updated"


def replace_all_exact(path: str, old: str, new: str, expected_count: int) -> None:
    file_path, content = read_source(path)
    count = content.count(old)

    if count == 0 and content.count(new) >= expected_count:
        status.setdefault(file_path, "already fixed")
        return

    if count != expected_count:
        raise RuntimeError(
            f"{path}: expected {expected_count} matches for {old!r}, found {count}"
        )

    pending[file_path] = content.replace(old, new)
    status[file_path] = "updated"


def create_url_helper() -> None:
    file_path = ROOT / "src/utils/urls.ts"
    expected = """import { site } from "@/data/site";

/**
 * Return the single public URL format used by the site:
 * HTTPS, apex domain, and a trailing slash for HTML routes.
 */
export function toCanonicalUrl(
  pathname: string,
  base: URL | string = site.url,
): string {
  const url = new URL(pathname, base);

  if (url.pathname !== "/" && !url.pathname.endsWith("/")) {
    url.pathname = `${url.pathname}/`;
  }

  url.search = "";
  url.hash = "";
  return url.toString();
}
"""

    if file_path.exists():
        current = file_path.read_text(encoding="utf-8")
        if current != expected:
            raise RuntimeError(
                "src/utils/urls.ts already exists with different content"
            )
        status[file_path] = "already fixed"
        return

    pending[file_path] = expected
    status[file_path] = "created"


def plan_changes() -> None:
    create_url_helper()

    replace_once(
        "astro.config.mjs",
        'export default defineConfig({\n  integrations: [tailwind(), react()],',
        'export default defineConfig({\n  trailingSlash: "always",\n  integrations: [tailwind(), react()],',
    )
    replace_once(
        "astro.config.mjs",
        '  build: {\n    inlineStylesheets: "auto",',
        '  build: {\n    format: "directory",\n    inlineStylesheets: "auto",',
    )

    replace_once(
        "src/layouts/Layout.astro",
        'import { site } from "@/data/site";',
        'import { site } from "@/data/site";\nimport { toCanonicalUrl } from "@/utils/urls";',
    )
    replace_once(
        "src/layouts/Layout.astro",
        '  canonical = new URL(Astro.url.pathname, Astro.site ?? site.url).toString(),',
        '  canonical = toCanonicalUrl(Astro.url.pathname, Astro.site ?? site.url),',
    )

    replace_once(
        "src/pages/sitemap.xml.ts",
        'import { site } from "@/data/site";',
        'import { toCanonicalUrl } from "@/utils/urls";',
    )
    replace_once(
        "src/pages/sitemap.xml.ts",
        '    { location: site.url, priority: "1.0" },\n'
        '    { location: `${site.url}/blog`, priority: "0.8" },',
        '    { location: toCanonicalUrl("/"), priority: "1.0" },\n'
        '    { location: toCanonicalUrl("/blog/"), priority: "0.8" },',
    )
    replace_once(
        "src/pages/sitemap.xml.ts",
        '      location: `${site.url}/projects/${project.id}`,',
        '      location: toCanonicalUrl(`/projects/${project.id}/`),',
    )
    replace_once(
        "src/pages/sitemap.xml.ts",
        '      location: `${site.url}/blog/${post.id}`,',
        '      location: toCanonicalUrl(`/blog/${post.id}/`),',
    )

    replace_once(
        "src/pages/blog/[slug].astro",
        'import { site } from "@/data/site";',
        'import { site } from "@/data/site";\nimport { toCanonicalUrl } from "@/utils/urls";',
    )
    replace_once(
        "src/pages/blog/[slug].astro",
        'const canonical = new URL(`/blog/${post.id}`, Astro.site ?? site.url).toString();',
        'const canonical = toCanonicalUrl(\n'
        '  `/blog/${post.id}/`,\n'
        '  Astro.site ?? site.url,\n'
        ');',
    )
    replace_once(
        "src/pages/blog/[slug].astro",
        '        href="/blog"',
        '        href="/blog/"',
    )
    replace_once(
        "src/pages/blog/[slug].astro",
        '              href={`/projects/${relatedProject.id}`}',
        '              href={`/projects/${relatedProject.id}/`}',
    )

    replace_once(
        "src/pages/projects/[slug].astro",
        'import { site } from "@/data/site";',
        'import { site } from "@/data/site";\nimport { toCanonicalUrl } from "@/utils/urls";',
    )
    replace_once(
        "src/pages/projects/[slug].astro",
        'const canonical = new URL(\n'
        '  `/projects/${project.id}`,\n'
        '  Astro.site ?? site.url,\n'
        ').toString();',
        'const canonical = toCanonicalUrl(\n'
        '  `/projects/${project.id}/`,\n'
        '  Astro.site ?? site.url,\n'
        ');',
    )

    replace_once(
        "src/components/nav.astro",
        '    href: "/blog",',
        '    href: "/blog/",',
    )
    replace_once(
        "src/components/nav.astro",
        'const isBlogActive = currentPath.startsWith("/blog") && item.href === "/blog";',
        'const isBlogActive = currentPath.startsWith("/blog") && item.href === "/blog/";',
    )
    replace_once(
        "src/components/footer.astro",
        'href="/blog">Blog</a>',
        'href="/blog/">Blog</a>',
    )
    replace_once(
        "src/pages/blog/index.astro",
        'href={`/blog/${post.id}`}',
        'href={`/blog/${post.id}/`}',
    )
    replace_all_exact(
        "src/components/projects.astro",
        'href={`/projects/${project.id}`}',
        'href={`/projects/${project.id}/`}',
        expected_count=3,
    )
    replace_once(
        "src/components/FeaturedProject.astro",
        'href="/blog/payrithm"',
        'href="/blog/payrithm/"',
    )
    replace_once(
        "src/content/projects/payrithm.md",
        'article: "/blog/payrithm"',
        'article: "/blog/payrithm/"',
    )

    replace_once(
        "nginx-host-albertqueralto.dev.conf",
        """map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}
""",
        """map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}

map $host $canonical_https_host {
    default $host;
    www.albertqueralto.dev albertqueralto.dev;
}
""",
    )
    replace_once(
        "nginx-host-albertqueralto.dev.conf",
        '        return 301 https://$host$request_uri;',
        '        return 301 https://$canonical_https_host$request_uri;',
    )


def write_changes() -> None:
    for file_path, content in pending.items():
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text(content, encoding="utf-8")

    for file_path in sorted(status, key=lambda item: str(item)):
        print(f"{status[file_path]}: {file_path.relative_to(ROOT)}")


def main() -> int:
    plan_changes()
    write_changes()
    print("\nSEO/indexing source changes applied successfully.")
    print("Next run: npm ci && npm run build")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as exc:
        print(f"\nERROR: {exc}", file=sys.stderr)
        print("No files were changed.", file=sys.stderr)
        raise SystemExit(1)
