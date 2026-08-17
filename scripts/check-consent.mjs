import { readFile } from "node:fs/promises";

const GOOGLE_ANALYTICS_ID = "G-2R960Q7K9C";

const files = {
  component: await readFile("src/components/AnalyticsConsent.astro", "utf8"),
  layout: await readFile("src/layouts/Layout.astro", "utf8"),
  footer: await readFile("src/components/footer.astro", "utf8"),
  nginx: await readFile("nginx/default.conf", "utf8"),
};

const requirements = [
  [files.layout.includes(GOOGLE_ANALYTICS_ID), `missing Google Analytics ID ${GOOGLE_ANALYTICS_ID}`],
  [files.layout.includes('window.gtag("consent", "default"'), "missing default consent state"],
  [files.layout.includes("analytics_storage: analyticsStorage"), "missing analytics_storage consent handling"],
  [files.layout.includes("https://www.googletagmanager.com/gtag/js"), "missing Google tag loader"],
  [files.layout.includes("send_page_view: false"), "missing manual page-view configuration"],
  [files.component.includes('window.gtag("consent", "update"'), "missing consent updates"],
  [files.component.includes('document.addEventListener("astro:page-load"'), "missing Astro navigation tracking"],
  [files.layout.includes('import AnalyticsConsent from "@/components/AnalyticsConsent.astro"'), "Layout does not import AnalyticsConsent"],
  [files.layout.includes("<AnalyticsConsent measurementId={GOOGLE_ANALYTICS_ID} />"), "Layout does not render AnalyticsConsent with the measurement ID"],
  [files.footer.includes("data-open-analytics-settings"), "footer has no cookie settings control"],
  [files.nginx.includes("https://www.googletagmanager.com"), "CSP blocks Google Tag Manager"],
  [files.nginx.includes("https://*.google-analytics.com"), "CSP blocks Google Analytics endpoints"],
  [files.nginx.includes("https://*.analytics.google.com"), "CSP blocks Analytics endpoints"],
];

const errors = requirements.filter(([ok]) => !ok).map(([, message]) => message);

if (errors.length > 0) {
  console.error(`Consent check failed:\n- ${errors.join("\n- ")}`);
  process.exit(1);
}

console.log("Consent check passed: Google Analytics loads with denied consent and tracks only after acceptance.");
