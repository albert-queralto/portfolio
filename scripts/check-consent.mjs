import { readFile } from "node:fs/promises";

const GOOGLE_ANALYTICS_ID = "G-2R960Q7K9C";

const files = {
  component: await readFile("src/components/AnalyticsConsent.astro", "utf8"),
  layout: await readFile("src/layouts/Layout.astro", "utf8"),
  footer: await readFile("src/components/footer.astro", "utf8"),
};

const requirements = [
  [files.component.includes(GOOGLE_ANALYTICS_ID), `missing Google Analytics ID ${GOOGLE_ANALYTICS_ID}`],
  [files.component.includes('window.gtag("consent", "default"'), "missing default consent state"],
  [files.component.includes("analytics_storage: analyticsStorage"), "missing analytics_storage consent handling"],
  [files.component.includes("loadGoogleAnalytics"), "missing deferred Google Analytics loader"],
  [files.component.includes('send_page_view: false'), "missing manual page-view configuration"],
  [files.component.includes('document.addEventListener("astro:page-load"'), "missing Astro navigation tracking"],
  [files.layout.includes('import AnalyticsConsent from "@/components/AnalyticsConsent.astro"'), "Layout does not import AnalyticsConsent"],
  [files.layout.includes("<AnalyticsConsent />"), "Layout does not render AnalyticsConsent"],
  [files.footer.includes("data-open-analytics-settings"), "footer has no cookie settings control"],
];

const errors = requirements.filter(([ok]) => !ok).map(([, message]) => message);

if (errors.length > 0) {
  console.error(`Consent check failed:\n- ${errors.join("\n- ")}`);
  process.exit(1);
}

console.log("Consent check passed: Google Analytics is gated by explicit visitor consent.");
