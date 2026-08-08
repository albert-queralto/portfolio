import { getCollection } from "astro:content";
import { toCanonicalUrl } from "@/utils/urls";

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
  const posts = await getCollection("blog", ({ data }) => !data.draft);
  
  const projects = await getCollection(
    "projects",
    ({ data }) => !data.draft,
  );

  const urls = [
    { location: toCanonicalUrl("/"), priority: "1.0" },
    { location: toCanonicalUrl("/blog/"), priority: "0.8" },

    ...projects.map((project) => ({
      location: toCanonicalUrl(`/projects/${project.id}/`),
      priority: project.data.featured ? "0.9" : "0.7",
    })),

    ...posts.map((post) => ({
      location: toCanonicalUrl(`/blog/${post.id}/`),
      lastModified: (
        post.data.updatedDate ?? post.data.date
      ).toISOString(),
      priority: post.data.featured ? "0.8" : "0.7",
    })),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
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
