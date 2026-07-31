#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="$ROOT_DIR/chatbot-documents"

mkdir -p "$TARGET/projects" "$TARGET/articles"
cp "$ROOT_DIR/public/CV.pdf" "$TARGET/CV.pdf"
cp "$ROOT_DIR"/src/content/projects/*.md "$TARGET/projects/"
cp "$ROOT_DIR"/src/content/blog/*.md "$TARGET/articles/"

if [[ ! -f "$TARGET/about-albert.md" ]]; then
  cat > "$TARGET/about-albert.md" <<'MD'
# About Albert Queralto

Albert Queralto is a software developer and data-science professional. Replace this paragraph with an accurate concise biography.

## Professional profile

Describe Albert's current role, main technical strengths, industries, languages, location, and the kinds of opportunities he is interested in.

## Contact

Website: https://albertqueralto.dev

Visitors should use the portfolio contact form for current availability, employment opportunities, or project proposals.

## Assistant boundaries

The assistant should answer only from this knowledge base. It must not invent qualifications, employment history, project outcomes, dates, contact information, or personal details.
MD
fi

echo "Prepared chatbot knowledge documents in $TARGET"
