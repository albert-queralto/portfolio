# Exact Next-Post Scheduling for an Astro Blog

This setup publishes future-dated Astro posts with **one systemd timer for exactly the next post**.

It does not rebuild hourly or weekly.

After every successful publication:

1. the deployment script rebuilds the portfolio;
2. `schedule-next-post.py` scans the blog frontmatter;
3. it finds the earliest future `publishAt`;
4. it schedules the systemd timer for `publishAt + 5 minutes`;
5. when that timer fires, the service rebuilds the site;
6. the scheduler then programs the following post;
7. when no future posts remain, the timer is disabled.

The VPS does **not** need Node.js for this implementation. The scheduler uses Python 3.

---

## 1. Architecture

```text
Future Markdown posts already committed to Git
                  │
                  ▼
      portfolio-publish.timer
       one exact future trigger
                  │
                  ▼
     portfolio-publish.service
                  │
                  ▼
 scripts/publish-scheduled-posts.sh
                  │
          ┌───────┴────────┐
          ▼                ▼
      git pull       Docker/Astro build
                           │
                           ▼
                 due post becomes public
                           │
                           ▼
             schedule-next-post.py
                           │
                 finds next publishAt
                           │
                           ▼
 sudo /usr/local/sbin/portfolio-publish-timer-set
                           │
                           ▼
       rewrites portfolio-publish.timer
                           │
                           ▼
                  next exact trigger
```

The privileged helper has one narrow job: write the portfolio timer and reload/restart it.

---

## 2. Paths used in this guide

```text
Linux user:
  albert

Portfolio:
  /home/albert/portfolio

Blog:
  /home/albert/portfolio/src/content/blog

Deployment script:
  /home/albert/portfolio/scripts/publish-scheduled-posts.sh

Scheduler:
  /home/albert/portfolio/scripts/schedule-next-post.py

Service:
  /etc/systemd/system/portfolio-publish.service

Generated timer:
  /etc/systemd/system/portfolio-publish.timer

Privileged helper:
  /usr/local/sbin/portfolio-publish-timer-set

Sudoers rule:
  /etc/sudoers.d/portfolio-publish
```

If your repository is somewhere else, replace `/home/albert/portfolio` everywhere.

Always use absolute paths in systemd. Do not use `~/portfolio`.

---

## 3. Blog frontmatter

A scheduled article should include an explicit timezone:

```yaml
---
title: "Scaling Celery Workers in a Production SaaS"
description: "..."
date: 2026-11-24
publishAt: 2026-11-24T08:00:00+01:00
tags: ["Celery", "Redis", "FastAPI"]
draft: false
cover: "/og/scaling-celery-workers-production-saas.png"
featured: false
---
```

Rules:

```yaml
draft: true
```

means do not publish.

```yaml
draft: false
publishAt: 2026-11-24T08:00:00+01:00
```

means approved and scheduled.

Always include a timezone offset:

```yaml
# Spain in summer
publishAt: 2026-09-15T08:00:00+02:00

# Spain in winter
publishAt: 2026-12-15T08:00:00+01:00
```

---

## 4. Astro must still filter future posts

The systemd scheduler controls **when a rebuild happens**.

Astro controls **whether the future article is included in that build**.

Use the future-date filter anywhere blog posts are exposed:

```ts
const now = new Date();

const posts = await getCollection("blog", ({ data }) => {
  if (data.draft) {
    return false;
  }

  if (data.publishAt && data.publishAt > now) {
    return false;
  }

  return true;
});
```

Check at least:

```text
src/pages/blog/index.astro
src/pages/blog/[slug].astro
src/pages/rss.xml.ts
```

Also search for any other blog collection queries:

```bash
grep -R 'getCollection("blog"' -n src
```

Future posts should not leak through direct article URLs, RSS, the homepage, tag pages, or other article lists.

---

## 5. Repository files to add

Add these files to the portfolio repository:

```text
scripts/publish-scheduled-posts.sh
scripts/schedule-next-post.py
scripts/portfolio-publish-timer-set
systemd/portfolio-publish.service
systemd/portfolio-publish.sudoers
```

Commit them so the VPS checkout stays clean:

```bash
git add scripts systemd
git commit -m "Add exact scheduled blog publishing"
git push
```

The supplied implementation bundle already contains these files.

---

## 6. `publish-scheduled-posts.sh`

The deployment script should be:

```bash
#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/albert/portfolio"
LOCK_FILE="/tmp/portfolio-publish.lock"

exec 9>"$LOCK_FILE"

if ! flock -n 9; then
  echo "[portfolio-publish] Another deployment is already running."
  exit 0
fi

cd "$APP_DIR"

echo "[portfolio-publish] Started at $(date --iso-8601=seconds)"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "[portfolio-publish] Repository contains local changes. Aborting."
  git status --short
  exit 1
fi

echo "[portfolio-publish] Pulling latest commit"
git pull --ff-only

echo "[portfolio-publish] Building portfolio"
docker compose build

echo "[portfolio-publish] Deploying portfolio"
docker compose up -d

echo "[portfolio-publish] Current containers"
docker compose ps

echo "[portfolio-publish] Scheduling next publication"
python3 "$APP_DIR/scripts/schedule-next-post.py"

echo "[portfolio-publish] Completed at $(date --iso-8601=seconds)"
```

Make it executable:

```bash
chmod +x /home/albert/portfolio/scripts/publish-scheduled-posts.sh
```

This replaces the old incomplete call:

```bash
node scripts/schedule-next-post.mjs
```

Node.js is not required on the host.

---

## 7. `schedule-next-post.py`

Install the supplied file at:

```text
/home/albert/portfolio/scripts/schedule-next-post.py
```

Make it executable:

```bash
chmod +x /home/albert/portfolio/scripts/schedule-next-post.py
```

It performs the following checks:

- scans `.md` and `.mdx` recursively;
- ignores `draft: true`;
- ignores posts without `publishAt`;
- rejects invalid timestamps;
- rejects timezone-less timestamps;
- converts `publishAt` to UTC;
- sorts all future posts;
- selects only the nearest future post;
- adds a five-minute publication buffer;
- calls the timer helper;
- disables the timer if no future posts remain.

The delay is controlled by:

```python
PUBLISH_DELAY_MINUTES = 5
```

For:

```yaml
publishAt: 2026-09-15T08:00:00+02:00
```

it schedules:

```text
2026-09-15 06:05:00 UTC
```

which is 08:05 in Spain that day.

---

## 8. Why a root helper is needed

The systemd service runs as:

```ini
User=albert
```

but this file must remain root-owned:

```text
/etc/systemd/system/portfolio-publish.timer
```

Do not make `/etc/systemd/system` writable by `albert`.

Instead, only this helper runs with sudo:

```text
/usr/local/sbin/portfolio-publish-timer-set
```

It accepts only:

```text
YYYY-MM-DDTHH:MM:SSZ
```

or:

```text
--disable
```

and it controls only `portfolio-publish.timer`.

---

## 9. Install the root-owned timer helper

From the repository:

```bash
sudo cp \
  /home/albert/portfolio/scripts/portfolio-publish-timer-set \
  /usr/local/sbin/portfolio-publish-timer-set
```

Set secure ownership and permissions:

```bash
sudo chown root:root \
  /usr/local/sbin/portfolio-publish-timer-set

sudo chmod 0755 \
  /usr/local/sbin/portfolio-publish-timer-set
```

Verify:

```bash
ls -l /usr/local/sbin/portfolio-publish-timer-set
```

Expected ownership:

```text
root root
```

Do not allow `albert` to modify this installed helper.

---

## 10. Install the narrow sudoers rule

Copy:

```bash
sudo cp \
  /home/albert/portfolio/systemd/portfolio-publish.sudoers \
  /etc/sudoers.d/portfolio-publish
```

Set permissions:

```bash
sudo chown root:root /etc/sudoers.d/portfolio-publish
sudo chmod 0440 /etc/sudoers.d/portfolio-publish
```

The rule is:

```text
albert ALL=(root) NOPASSWD: /usr/local/sbin/portfolio-publish-timer-set *
```

Validate it before continuing:

```bash
sudo visudo -cf /etc/sudoers.d/portfolio-publish
```

Expected:

```text
/etc/sudoers.d/portfolio-publish: parsed OK
```

---

## 11. Test the helper privilege

Use a harmless far-future timestamp:

```bash
sudo -u albert -H \
  sudo -n /usr/local/sbin/portfolio-publish-timer-set \
  2099-01-01T12:00:00Z
```

It should not ask for a password.

Inspect the generated timer:

```bash
sudo cat /etc/systemd/system/portfolio-publish.timer
```

You should see:

```ini
[Unit]
Description=Run portfolio publication for the next scheduled blog post

[Timer]
OnCalendar=2099-01-01 12:00:00 UTC
Persistent=true
AccuracySec=1min
Unit=portfolio-publish.service

[Install]
WantedBy=timers.target
```

The real scheduler will overwrite this test timestamp during bootstrap.

---

## 12. Install the systemd service

Copy:

```bash
sudo cp \
  /home/albert/portfolio/systemd/portfolio-publish.service \
  /etc/systemd/system/portfolio-publish.service
```

Set ownership:

```bash
sudo chown root:root \
  /etc/systemd/system/portfolio-publish.service

sudo chmod 0644 \
  /etc/systemd/system/portfolio-publish.service
```

The service is:

```ini
[Unit]
Description=Publish scheduled Astro blog posts
After=network-online.target docker.service
Wants=network-online.target
Requires=docker.service

[Service]
Type=oneshot
User=albert
Group=albert
WorkingDirectory=/home/albert/portfolio
ExecStart=/home/albert/portfolio/scripts/publish-scheduled-posts.sh
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
TimeoutStartSec=30min
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

---

## 13. Fix: `Assignment outside of section`

If you see:

```text
/etc/systemd/system/portfolio-publish.service:1:
Assignment outside of section. Ignoring.
```

inspect:

```bash
sudo nl -ba /etc/systemd/system/portfolio-publish.service
```

Line 1 must be:

```text
1  [Unit]
```

not:

```text
1  Description=...
```

Do not paste Markdown fences such as ````ini` into the actual unit file.

After fixing it:

```bash
sudo systemctl daemon-reload
```

---

## 14. Fix: wrong `/portfolio` path

If logs show:

```text
cd: /portfolio: No such file or directory
```

check:

```bash
grep -n 'APP_DIR' \
  /home/albert/portfolio/scripts/publish-scheduled-posts.sh
```

It should be:

```bash
APP_DIR="/home/albert/portfolio"
```

Check systemd too:

```bash
systemctl show portfolio-publish.service \
  -p WorkingDirectory \
  -p ExecStart
```

Both paths should point to `/home/albert/portfolio`.

---

## 15. Fix: `node: command not found`

This exact-scheduling implementation does not use Node on the host.

Remove:

```bash
node scripts/schedule-next-post.mjs
```

and use:

```bash
python3 "$APP_DIR/scripts/schedule-next-post.py"
```

Check Python:

```bash
python3 --version
```

---

## 16. Validate syntax and reload systemd

Run:

```bash
sudo systemd-analyze verify \
  /etc/systemd/system/portfolio-publish.service \
  /etc/systemd/system/portfolio-publish.timer

sudo systemctl daemon-reload
```

You may still see unrelated XFS warnings such as:

```text
Support for option CPUAccounting= has been removed and it is ignored
```

Those are not portfolio errors.

---

## 17. Bootstrap the first real timer

Once the future posts are present on the VPS:

```bash
cd /home/albert/portfolio
python3 scripts/schedule-next-post.py
```

The scheduler uses the sudoers permission automatically.

Example output:

```text
[portfolio-scheduler] Next post: operating-postgresql-redis-celery-8gb-vps.md at 2026-09-15T06:00:00+00:00
[portfolio-scheduler] Scheduling rebuild for 2026-09-15T06:05:00+00:00 (publishAt + 5 minutes)
```

Then check:

```bash
systemctl list-timers portfolio-publish.timer
```

This is the only manual bootstrap needed for an already-populated queue of future posts.

After each publication, the service programs the next one itself.

---

## 18. Inspect the generated timer

```bash
sudo cat /etc/systemd/system/portfolio-publish.timer
```

Check state:

```bash
systemctl status portfolio-publish.timer
```

Expected while waiting:

```text
Active: active (waiting)
```

Check the next trigger:

```bash
systemctl list-timers portfolio-publish.timer
```

Also:

```bash
systemctl show portfolio-publish.timer \
  -p NextElapseUSecRealtime \
  -p LastTriggerUSec
```

---

## 19. Test the service manually

Run:

```bash
sudo systemctl start portfolio-publish.service
```

Then:

```bash
systemctl show portfolio-publish.service \
  -p Result \
  -p ExecMainStatus
```

Expected:

```text
Result=success
ExecMainStatus=0
```

Because the service is `Type=oneshot`, it may show as `inactive (dead)` after success. That is normal.

Inspect logs:

```bash
sudo journalctl \
  -u portfolio-publish.service \
  -n 100 \
  --no-pager
```

---

## 20. Full validation sequence

After changing the service/helper/timer implementation, use:

```bash
sudo systemd-analyze verify \
  /etc/systemd/system/portfolio-publish.service \
  /etc/systemd/system/portfolio-publish.timer

sudo systemctl daemon-reload

sudo systemctl start portfolio-publish.service

systemctl show portfolio-publish.service \
  -p Result \
  -p ExecMainStatus

sudo journalctl \
  -u portfolio-publish.service \
  -n 100 \
  --no-pager

sudo systemctl restart portfolio-publish.timer

systemctl list-timers portfolio-publish.timer
```

A healthy service should end with:

```text
Result=success
ExecMainStatus=0
```

---

## 21. End-to-end test with a temporary article

This is the strongest test.

Suppose the local time is 14:00.

Create a temporary post:

```yaml
---
title: "Scheduled Publishing Test"
description: "Temporary scheduling test."
date: 2026-09-06
publishAt: 2026-09-06T14:10:00+02:00
tags: ["Test"]
draft: false
featured: false
---
```

Commit and push it:

```bash
git add .
git commit -m "Test exact scheduled publishing"
git push
```

Deploy once before 14:10:

```bash
sudo systemctl start portfolio-publish.service
```

The article should still be hidden.

The service should discover it as the next future post and create a timer for 14:15 local time.

Verify:

```bash
systemctl list-timers portfolio-publish.timer
```

Watch the logs:

```bash
sudo journalctl -u portfolio-publish.service -f
```

At 14:15 the timer should automatically start the service.

After the build, the temporary article should be visible.

At the end of that same run, the scheduler should automatically replace the timer with the following future article.

This proves the complete chain:

```text
future article hidden
    ↓
next timer generated
    ↓
timer fires automatically
    ↓
service rebuilds
    ↓
article becomes public
    ↓
next future timer generated
```

Delete the temporary article afterward and deploy again.

---

## 22. What happens when no future posts remain

The scheduler prints:

```text
[portfolio-scheduler] No future posts remain.
[portfolio-scheduler] Disabling the publication timer.
```

The helper disables the timer:

```bash
systemctl disable --now portfolio-publish.timer
```

That is correct.

When you later add a new future article, deploy it and bootstrap again:

```bash
cd /home/albert/portfolio
python3 scripts/schedule-next-post.py
```

The helper will enable/start the timer automatically.

---

## 23. Why the timer uses UTC

A post can use:

```yaml
publishAt: 2026-09-15T08:00:00+02:00
```

Python converts that instant to:

```text
2026-09-15T06:00:00Z
```

then adds five minutes:

```text
2026-09-15T06:05:00Z
```

The generated timer becomes:

```ini
OnCalendar=2026-09-15 06:05:00 UTC
```

This avoids daylight-saving ambiguity inside systemd.

The timezone meaning stays explicit in each article's `publishAt` value.

---

## 24. Multiple posts at the same timestamp

If two posts have the same `publishAt`, one build publishes both.

Afterward both timestamps are in the past, so the scheduler advances to the next later article.

---

## 25. If the publication build fails

The deployment script uses:

```bash
set -euo pipefail
```

If `git pull`, Docker build, deployment, or another command fails, the service exits before scheduling the next article.

That prevents the timer from advancing after an unsuccessful publication.

Inspect:

```bash
sudo journalctl \
  -u portfolio-publish.service \
  -n 200 \
  --no-pager
```

Fix the problem and rerun:

```bash
sudo systemctl start portfolio-publish.service
```

A successful rerun will program the next timer.

---

## 26. Dirty Git checkout protection

The script aborts if:

```bash
git status --porcelain
```

contains local changes.

Check:

```bash
cd /home/albert/portfolio
git status --short
```

The VPS should normally be a clean deployment checkout.

Commit the scheduling scripts to the repository instead of editing them only on the server.

---

## 27. Docker permissions

Verify the service user can access Docker:

```bash
sudo -u albert -H docker ps
```

If it fails:

```bash
groups albert
```

Make sure `albert` has the required Docker access.

---

## 28. Git authentication

The service cannot answer an interactive password prompt.

Test:

```bash
sudo -u albert -H bash -lc '
  cd /home/albert/portfolio &&
  git pull --ff-only
'
```

This must complete without prompting.

---

## 29. File ownership and permissions

Check:

```bash
ls -l \
  /home/albert/portfolio/scripts/publish-scheduled-posts.sh \
  /home/albert/portfolio/scripts/schedule-next-post.py \
  /usr/local/sbin/portfolio-publish-timer-set \
  /etc/systemd/system/portfolio-publish.service \
  /etc/systemd/system/portfolio-publish.timer \
  /etc/sudoers.d/portfolio-publish
```

Recommended:

```text
publish-scheduled-posts.sh
  owned by albert, executable

schedule-next-post.py
  owned by albert, executable

portfolio-publish-timer-set
  root:root, mode 0755

portfolio-publish.service
  root:root, mode 0644

portfolio-publish.timer
  root:root, mode 0644

/etc/sudoers.d/portfolio-publish
  root:root, mode 0440
```

---

## 30. Initial installation checklist

Make repository scripts executable:

```bash
chmod +x \
  /home/albert/portfolio/scripts/publish-scheduled-posts.sh \
  /home/albert/portfolio/scripts/schedule-next-post.py \
  /home/albert/portfolio/scripts/portfolio-publish-timer-set
```

Install helper:

```bash
sudo cp \
  /home/albert/portfolio/scripts/portfolio-publish-timer-set \
  /usr/local/sbin/portfolio-publish-timer-set

sudo chown root:root \
  /usr/local/sbin/portfolio-publish-timer-set

sudo chmod 0755 \
  /usr/local/sbin/portfolio-publish-timer-set
```

Install sudoers:

```bash
sudo cp \
  /home/albert/portfolio/systemd/portfolio-publish.sudoers \
  /etc/sudoers.d/portfolio-publish

sudo chown root:root /etc/sudoers.d/portfolio-publish
sudo chmod 0440 /etc/sudoers.d/portfolio-publish
sudo visudo -cf /etc/sudoers.d/portfolio-publish
```

Install service:

```bash
sudo cp \
  /home/albert/portfolio/systemd/portfolio-publish.service \
  /etc/systemd/system/portfolio-publish.service

sudo chown root:root \
  /etc/systemd/system/portfolio-publish.service

sudo chmod 0644 \
  /etc/systemd/system/portfolio-publish.service

sudo systemctl daemon-reload
```

Bootstrap the timer:

```bash
cd /home/albert/portfolio
python3 scripts/schedule-next-post.py
```

Verify:

```bash
systemctl list-timers portfolio-publish.timer
```

---

## 31. Normal publishing workflow

Once installed:

```text
1. Write future posts locally.

2. Set:
   draft: false
   publishAt: exact ISO-8601 future timestamp

3. Commit and push the articles.

4. Deploy once so the VPS receives the new future posts.

5. That deployment schedules the earliest future post.

6. At publishAt + 5 minutes:
   timer fires
   → service rebuilds
   → article becomes public
   → scheduler finds the next article
   → timer is rewritten.

7. Repeat automatically until no future posts remain.
```

---

## 32. Example timeline

Posts:

```text
A: 2026-09-15T08:00:00+02:00
B: 2026-09-29T08:00:00+02:00
C: 2026-10-13T08:00:00+02:00
```

Initial bootstrap generates:

```ini
OnCalendar=2026-09-15 06:05:00 UTC
```

September 15:

```text
06:05 UTC
→ timer fires
→ service rebuilds
→ A becomes public
→ scheduler finds B
```

Timer becomes:

```ini
OnCalendar=2026-09-29 06:05:00 UTC
```

September 29:

```text
→ B becomes public
→ scheduler finds C
```

Timer becomes:

```ini
OnCalendar=2026-10-13 06:05:00 UTC
```

After C publishes, if no other future posts exist:

```text
portfolio-publish.timer disabled
```
