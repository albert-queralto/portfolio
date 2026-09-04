import { readFile } from "node:fs/promises";

const requiredEvents = [
  "project_view",
  "project_live_demo_click",
  "github_click",
  "linkedin_click",
  "cv_download",
  "contact_start",
  "contact_submit",
  "blog_view",
  "blog_75_percent",
  "email_click",
];

const [layout, analytics, consent, projectPage, projects, flagships, blogPage, contact] =
  await Promise.all([
    readFile("src/layouts/Layout.astro", "utf8"),
    readFile("src/components/AnalyticsEvents.astro", "utf8"),
    readFile("src/components/AnalyticsConsent.astro", "utf8"),
    readFile("src/pages/projects/[slug].astro", "utf8"),
    readFile("src/components/projects.astro", "utf8"),
    readFile("src/components/FeaturedProject.astro", "utf8"),
    readFile("src/pages/blog/[slug].astro", "utf8"),
    readFile("src/components/contact.astro", "utf8"),
  ]);

const failures = [];
const requireText = (source, text, description) => {
  if (!source.includes(text)) failures.push(description);
};

requireText(layout, "<AnalyticsEvents />", "AnalyticsEvents must be mounted in the shared layout.");
requireText(
  analytics,
  'localStorage.getItem(STORAGE_KEY) === GRANTED',
  "Custom events must remain consent-gated.",
);
requireText(
  consent,
  'new CustomEvent("portfolio:analytics-consent-changed"',
  "Consent changes must notify the event tracker.",
);
requireText(
  projectPage,
  "data-analytics-project-page",
  "Project detail pages must expose analytics context.",
);
requireText(
  projects,
  'data-analytics-event="project_live_demo_click"',
  "Project-grid live previews must be tagged.",
);
requireText(
  flagships,
  '"project_live_demo_click"',
  "Flagship live application links must be tagged.",
);
requireText(
  blogPage,
  "data-analytics-blog-content",
  "Blog articles must expose their readable content for 75% tracking.",
);
requireText(
  contact,
  'new CustomEvent("portfolio:contact-submit-success")',
  "Successful contact submissions must emit the analytics signal.",
);

for (const eventName of requiredEvents) {
  requireText(analytics, `"${eventName}"`, `Missing analytics event: ${eventName}`);
}

const forbiddenContactPayloads = ["contact-name", "contact-email", "contact-message", "FormData"];
for (const value of forbiddenContactPayloads) {
  if (analytics.includes(value)) {
    failures.push(`AnalyticsEvents must not read contact-form PII (${value}).`);
  }
}

if (failures.length > 0) {
  console.error("Analytics event checks failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Analytics event checks passed.");
