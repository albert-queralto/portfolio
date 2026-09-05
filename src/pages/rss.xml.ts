import rss from "@astrojs/rss";
import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { site } from "@/data/site";

export const GET: APIRoute = async ({ site: astroSite }) => {
  const now = new Date();

  const posts = (
    await getCollection("blog", ({ data }) => {
      if (data.draft) return false;
      if (data.publishAt && data.publishAt > now) return false;
      return true;
    })
  ).sort(
    (a, b) =>
      b.data.date.valueOf() - a.data.date.valueOf(),
  );

  return rss({
    title: `${site.name} — Machine Learning and Data Engineering`,
    description:
      "Articles about machine learning, data systems, model validation, and production engineering.",
    site: astroSite ?? new URL(site.url),
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.date,
      link: `/blog/${post.id}`,
      categories: post.data.tags,
    })),
  });
};