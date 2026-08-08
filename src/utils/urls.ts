import { site } from "@/data/site";

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
