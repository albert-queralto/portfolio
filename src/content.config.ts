import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const blog = defineCollection({
  loader: glob({
    pattern: "**/*.md",
    base: "./src/content/blog",
  }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()),
    draft: z.boolean().default(false),
    featured: z.boolean().default(false),
    project: z.string().optional(),
    cover: z.string().optional(),
    series: z.string().optional(),
  }),
});

const projects = defineCollection({
  loader: glob({
    pattern: "**/*.md",
    base: "./src/content/projects",
  }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    order: z.number(),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),

    status: z.enum(["Deployed", "Completed", "In progress"]),
    category: z.enum(["Data Science", "Machine Learning", "Web"]),
    focus: z.string(),

    image: z.string(),
    source: z.string().url().optional(),
    preview: z.string().url().optional(),
    article: z.string().optional(),

    technologies: z.array(z.string()),
    metrics: z
      .array(
        z.object({
          label: z.string(),
          value: z.string(),
        }),
      )
      .default([]),
  }),
});

export const collections = {
  blog,
  projects,
};