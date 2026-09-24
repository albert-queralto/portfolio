import { getCollection } from "astro:content";
import { locales } from "@/i18n/config";
import {
  contentLocale,
  contentTranslationKey,
  isPublished,
  localizedAbsoluteUrl,
} from "@/i18n/utils";
import { site } from "@/data/site";

export const prerender = true;

function escapeXml(value: string) {
  return value.replace(/[<>&'\"]/g, (character) => {
    const entities: Record<string, string> = {
      "<": "&lt;",
      ">": "&gt;",
      "&": "&amp;",
      "'": "&apos;",
      '"': "&quot;",
    };
    return entities[character];
  });
}

export async function GET() {
  const now = new Date();
  const posts = await getCollection("blog", ({ data }) => isPublished(data, now));
  const projects = await getCollection("projects", ({ data }) => !data.draft);

  const urls = [
    ...locales.flatMap((locale) => [
      { location: localizedAbsoluteUrl(locale, "/", site.url), priority: "1.0" },
      { location: localizedAbsoluteUrl(locale, "/blog/", site.url), priority: "0.8" },
    ]),
    ...projects.map((project) => {
      const locale = contentLocale(project.data);
      const key = contentTranslationKey(project.id, project.data);
      return {
        location: localizedAbsoluteUrl(locale, `/projects/${key}/`, site.url),
        priority: project.data.featured ? "0.9" : "0.7",
      };
    }),
    ...posts.map((post) => {
      const locale = contentLocale(post.data);
      const key = contentTranslationKey(post.id, post.data);
      return {
        location: localizedAbsoluteUrl(locale, `/blog/${key}/`, site.url),
        lastModified: (post.data.updatedDate ?? post.data.date).toISOString(),
        priority: post.data.featured ? "0.8" : "0.7",
      };
    }),
  ];

  const unique = [...new Map(urls.map((url) => [url.location, url])).values()];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${unique
  .map(
    (url) => `  <url>
    <loc>${escapeXml(url.location)}</loc>${
      "lastModified" in url ? `\n    <lastmod>${url.lastModified}</lastmod>` : ""
    }
    <priority>${url.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>`;

  return new Response(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
