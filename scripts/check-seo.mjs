import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("../dist/", import.meta.url);
const rootPath = root.pathname;

function walk(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function fail(message) {
  console.error(`SEO check failed: ${message}`);
  process.exitCode = 1;
}

function hasMeta(html, attribute, value) {
  const pattern = new RegExp(`<meta\\s+[^>]*${attribute}=["']${value}["'][^>]*>`, "i");
  return pattern.test(html);
}

function hasLink(html, rel) {
  const pattern = new RegExp(`<link\\s+[^>]*rel=["']${rel}["'][^>]*>`, "i");
  return pattern.test(html);
}

function jsonLdTypes(html) {
  const types = new Set();
  const scripts = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );

  function collect(node) {
    if (Array.isArray(node)) {
      node.forEach(collect);
      return;
    }
    if (!node || typeof node !== "object") return;
    if (typeof node["@type"] === "string") types.add(node["@type"]);
    if (Array.isArray(node["@type"])) node["@type"].forEach((type) => types.add(type));
    Object.values(node).forEach(collect);
  }

  for (const match of scripts) {
    try {
      collect(JSON.parse(match[1]));
    } catch (error) {
      fail(`invalid JSON-LD: ${error.message}`);
    }
  }

  return types;
}

const htmlFiles = walk(rootPath).filter((path) => path.endsWith(".html"));

for (const file of htmlFiles) {
  const html = readFileSync(file, "utf8");
  const page = relative(rootPath, file);

  if (!hasLink(html, "canonical")) fail(`${page} is missing rel=canonical`);
  if (!hasMeta(html, "property", "og:title")) fail(`${page} is missing og:title`);
  if (!hasMeta(html, "property", "og:description")) fail(`${page} is missing og:description`);
  if (!hasMeta(html, "property", "og:image")) fail(`${page} is missing og:image`);
  if (!hasMeta(html, "name", "twitter:card")) fail(`${page} is missing twitter:card`);

  const types = jsonLdTypes(html);
  if (!types.has("Person")) fail(`${page} is missing Person JSON-LD`);
  if (!types.has("WebSite")) fail(`${page} is missing WebSite JSON-LD`);

  if (/^projects\/(payrithm|tenderwise)\/index\.html$/.test(page)) {
    if (!types.has("SoftwareApplication")) {
      fail(`${page} is missing SoftwareApplication JSON-LD`);
    }
    if (!types.has("BreadcrumbList")) {
      fail(`${page} is missing BreadcrumbList JSON-LD`);
    }
  }

  if (/^blog\/[^/]+\/index\.html$/.test(page)) {
    if (!types.has("BlogPosting")) fail(`${page} is missing BlogPosting JSON-LD`);
    if (!types.has("BreadcrumbList")) fail(`${page} is missing BreadcrumbList JSON-LD`);
  }
}

if (!process.exitCode) {
  console.log(`SEO check passed for ${htmlFiles.length} HTML pages.`);
}
