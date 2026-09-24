// @ts-check
import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import react from "@astrojs/react";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

const srcDirectory = fileURLToPath(new URL("./src", import.meta.url));

// https://astro.build/config
export default defineConfig({
  trailingSlash: "always",
  integrations: [tailwind(), react()],
  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex],
  },
  vite: {
    resolve: {
      alias: {
        "@": srcDirectory,
        "@components": `${srcDirectory}/components`,
      },
    },
  },
  site: "https://albertqueralto.dev",
  i18n: {
    defaultLocale: "en",
    locales: ["en", "ca", "es", "de"],
    routing: {
      prefixDefaultLocale: false,
    },
  },
  output: "static",
  build: {
    format: "directory",
    inlineStylesheets: "auto",
  },
  server: {
    host: true,
    port: 4321,
  },
});
