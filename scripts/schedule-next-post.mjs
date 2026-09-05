import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const POSTS_DIRECTORY = path.resolve(
  process.cwd(),
  "src/content/blog",
);

const files = fs
  .readdirSync(POSTS_DIRECTORY)
  .filter((file) => file.endsWith(".md"));

const now = new Date();

const futurePosts = [];

for (const file of files) {
  const filepath = path.join(POSTS_DIRECTORY, file);
  const source = fs.readFileSync(filepath, "utf8");

  const draftMatch = source.match(
    /^draft:\s*(true|false)\s*$/m,
  );

  if (draftMatch?.[1] === "true") {
    continue;
  }

  const publishMatch = source.match(
    /^publishAt:\s*(.+)\s*$/m,
  );

  if (!publishMatch) {
    continue;
  }

  const publishAt = new Date(
    publishMatch[1].trim().replace(/^["']|["']$/g, ""),
  );

  if (
    Number.isNaN(publishAt.valueOf()) ||
    publishAt <= now
  ) {
    continue;
  }

  futurePosts.push({
    file,
    publishAt,
  });
}

futurePosts.sort(
  (a, b) =>
    a.publishAt.valueOf() - b.publishAt.valueOf(),
);

if (futurePosts.length === 0) {
  console.log("No future posts to schedule.");
  process.exit(0);
}

const next = futurePosts[0];

console.log(
  `Next publication: ${next.file} at ${next.publishAt.toISOString()}`,
);