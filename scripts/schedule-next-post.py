#!/usr/bin/env python3
from __future__ import annotations

import re
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path

POSTS_DIRECTORY = Path.cwd() / "src" / "content" / "blog"
HELPER = "/usr/local/sbin/portfolio-publish-timer-set"
PUBLISH_DELAY_MINUTES = 5


@dataclass(frozen=True)
class FuturePost:
    path: Path
    publish_at: datetime


def read_frontmatter(path: Path) -> str:
    source = path.read_text(encoding="utf-8")
    if not source.startswith("---"):
        return ""
    match = re.match(r"^---\s*\n(.*?)\n---(?:\s*\n|$)", source, flags=re.DOTALL)
    return match.group(1) if match else ""


def parse_scalar(frontmatter: str, key: str) -> str | None:
    match = re.search(
        rf"^{re.escape(key)}:\s*(.*?)\s*$",
        frontmatter,
        flags=re.MULTILINE,
    )
    if not match:
        return None

    value = match.group(1).strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
        value = value[1:-1]
    return value


def parse_publish_at(value: str, path: Path) -> datetime:
    normalized = value[:-1] + "+00:00" if value.endswith("Z") else value

    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise ValueError(
            f"{path}: invalid publishAt value {value!r}. "
            "Use ISO-8601 with a timezone, e.g. 2026-09-15T08:00:00+02:00."
        ) from exc

    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise ValueError(
            f"{path}: publishAt must include a timezone offset, e.g. "
            "2026-09-15T08:00:00+02:00."
        )

    return parsed.astimezone(timezone.utc)


def discover_future_posts() -> list[FuturePost]:
    if not POSTS_DIRECTORY.is_dir():
        raise RuntimeError(f"Blog directory does not exist: {POSTS_DIRECTORY}")

    now = datetime.now(timezone.utc)
    future_posts: list[FuturePost] = []

    files = sorted(
        path
        for path in POSTS_DIRECTORY.rglob("*")
        if path.is_file() and path.suffix.lower() in {".md", ".mdx"}
    )

    for path in files:
        frontmatter = read_frontmatter(path)
        if not frontmatter:
            continue

        draft = (parse_scalar(frontmatter, "draft") or "false").lower()
        if draft == "true":
            continue

        publish_value = parse_scalar(frontmatter, "publishAt")
        if not publish_value:
            continue

        publish_at = parse_publish_at(publish_value, path)
        if publish_at <= now:
            continue

        future_posts.append(FuturePost(path=path, publish_at=publish_at))

    future_posts.sort(key=lambda post: post.publish_at)
    return future_posts


def run_helper(argument: str) -> None:
    subprocess.run(["sudo", "-n", HELPER, argument], check=True)


def main() -> int:
    try:
        future_posts = discover_future_posts()
    except (OSError, RuntimeError, ValueError) as exc:
        print(f"[portfolio-scheduler] ERROR: {exc}", file=sys.stderr)
        return 1

    if not future_posts:
        print("[portfolio-scheduler] No future posts remain.")
        print("[portfolio-scheduler] Disabling the publication timer.")
        try:
            run_helper("--disable")
        except subprocess.CalledProcessError as exc:
            print(
                f"[portfolio-scheduler] ERROR: timer helper failed with exit code {exc.returncode}.",
                file=sys.stderr,
            )
            return exc.returncode or 1
        return 0

    next_post = future_posts[0]
    trigger_at = next_post.publish_at + timedelta(minutes=PUBLISH_DELAY_MINUTES)
    trigger_argument = trigger_at.strftime("%Y-%m-%dT%H:%M:%SZ")
    relative_name = next_post.path.relative_to(POSTS_DIRECTORY)

    print(
        f"[portfolio-scheduler] Next post: {relative_name} "
        f"at {next_post.publish_at.isoformat()}"
    )
    print(
        f"[portfolio-scheduler] Scheduling rebuild for {trigger_at.isoformat()} "
        f"(publishAt + {PUBLISH_DELAY_MINUTES} minutes)"
    )

    try:
        run_helper(trigger_argument)
    except FileNotFoundError:
        print(f"[portfolio-scheduler] ERROR: helper not found: {HELPER}", file=sys.stderr)
        return 1
    except subprocess.CalledProcessError as exc:
        print(
            f"[portfolio-scheduler] ERROR: timer helper failed with exit code {exc.returncode}.",
            file=sys.stderr,
        )
        return exc.returncode or 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
