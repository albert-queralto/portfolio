import { site } from "@/data/site";

export type JsonLdNode = Record<string, unknown>;

export const PERSON_ID = `${site.url}/#person`;
export const WEBSITE_ID = `${site.url}/#website`;

export function absoluteUrl(pathOrUrl: string, base: URL | string = site.url): string {
  return new URL(pathOrUrl, base).toString();
}

export function getBaseStructuredData(): JsonLdNode[] {
  return [
    {
      "@type": "Person",
      "@id": PERSON_ID,
      name: site.name,
      url: `${site.url}/`,
      jobTitle: site.role,
      description: site.description,
      address: {
        "@type": "PostalAddress",
        addressLocality: "Barcelona",
        addressCountry: "ES",
      },
      alumniOf: [
        {
          "@type": "CollegeOrUniversity",
          name: "Universitat Autònoma de Barcelona",
        },
        {
          "@type": "CollegeOrUniversity",
          name: "Universitat Oberta de Catalunya",
        },
      ],
      knowsAbout: [...site.keywords],
      sameAs: [site.github, site.linkedin],
    },
    {
      "@type": "WebSite",
      "@id": WEBSITE_ID,
      url: `${site.url}/`,
      name: `${site.name} Portfolio`,
      alternateName: site.title,
      description: site.description,
      inLanguage: "en",
      publisher: {
        "@id": PERSON_ID,
      },
    },
  ];
}

export function buildBreadcrumbList(
  items: Array<{ name: string; url: string }>,
): JsonLdNode {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

interface BlogPostingOptions {
  canonical: string;
  title: string;
  description: string;
  published: Date;
  modified?: Date;
  image: string;
  tags: string[];
  readingTimeMinutes: number;
  wordCount: number;
  section?: string;
}

export function buildBlogPosting({
  canonical,
  title,
  description,
  published,
  modified,
  image,
  tags,
  readingTimeMinutes,
  wordCount,
  section = "Machine Learning & Data Science",
}: BlogPostingOptions): JsonLdNode {
  return {
    "@type": "BlogPosting",
    "@id": `${canonical}#article`,
    headline: title,
    description,
    url: canonical,
    mainEntityOfPage: canonical,
    datePublished: published.toISOString(),
    dateModified: (modified ?? published).toISOString(),
    inLanguage: "en",
    image: absoluteUrl(image),
    keywords: tags,
    articleSection: section,
    wordCount,
    timeRequired: `PT${readingTimeMinutes}M`,
    author: {
      "@id": PERSON_ID,
    },
    publisher: {
      "@id": PERSON_ID,
    },
    isPartOf: {
      "@id": WEBSITE_ID,
    },
  };
}

interface SoftwareApplicationOptions {
  canonical: string;
  name: string;
  description: string;
  screenshot: string;
  technologies: string[];
  applicationCategory: string;
  liveUrl?: string;
  sourceUrl?: string;
}

export function buildSoftwareApplication({
  canonical,
  name,
  description,
  screenshot,
  technologies,
  applicationCategory,
  liveUrl,
  sourceUrl,
}: SoftwareApplicationOptions): JsonLdNode {
  const sameAs = [liveUrl, sourceUrl].filter((value): value is string => Boolean(value));

  return {
    "@type": ["SoftwareApplication", "WebApplication"],
    "@id": `${canonical}#software`,
    name,
    description,
    url: canonical,
    applicationCategory,
    operatingSystem: "Any",
    inLanguage: "en",
    screenshot: absoluteUrl(screenshot),
    keywords: technologies,
    creator: {
      "@id": PERSON_ID,
    },
    ...(sameAs.length > 0 ? { sameAs } : {}),
  };
}

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
