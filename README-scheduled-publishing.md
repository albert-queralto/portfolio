# Scheduled Blog Publishing with Astro, Docker, and systemd

This guide explains how to publish future-dated Astro blog posts automatically on a VPS without rebuilding the site every hour.

The setup uses:

- Astro content frontmatter with `publishAt`
- a deployment script that rebuilds the static site
- a `systemd` service that runs the deployment script
- a recurring `systemd` timer that launches the service on your publishing schedule

The recommended setup is to publish on a predictable schedule, for example every Tuesday at 08:00, and run the rebuild a few minutes later.

## 1. How the publishing flow works

```text
Write article
    ↓
Set draft: false
    ↓
Set publishAt to a future date/time
    ↓
Commit and push the article
    ↓
Astro excludes the article from the current static build
    ↓
Scheduled publication time arrives
    ↓
systemd timer starts the publication service
    ↓
publication service runs the deployment script
    ↓
Astro rebuilds
    ↓
publishAt <= current time
    ↓
article is included in the generated site
```

This keeps the site fully static while still allowing scheduled publishing.

## 2. Prerequisites

This guide assumes:

- the portfolio is already deployed on a Linux VPS;
- Docker and Docker Compose are installed;
- the portfolio is served from a Git checkout on the VPS;
- the application can already be deployed manually with Docker Compose;
- the blog uses Astro content collections;
- future posts are filtered by `publishAt`;
- the server uses `systemd`.

Check systemd:

```bash
systemctl --version
```

Check Docker:

```bash
docker --version
docker compose version
```

## 3. Use `publishAt` in blog frontmatter

A scheduled post should look like this:

```yaml
---
title: "Operating PostgreSQL, Redis and Celery on an 8 GB VPS"
description: "What running PostgreSQL, Redis, Celery workers and multiple SaaS applications on an 8 GB VPS taught me."
date: 2026-09-15
publishAt: 2026-09-15T08:00:00+02:00
tags: ["DevOps", "PostgreSQL", "Redis", "Celery", "Docker"]
draft: false
cover: "/og/operating-postgresql-redis-celery-8gb-vps.png"
featured: false
---
```

Use `draft: true` while the article is still being edited.

Use `draft: false` only when the article is approved and ready to be published automatically.

The `publishAt` value should include a timezone offset.

For Central European Summer Time:

```yaml
publishAt: 2026-09-15T08:00:00+02:00
```

For Central European Time:

```yaml
publishAt: 2026-12-15T08:00:00+01:00
```

Using an explicit offset avoids depending on the timezone of the build machine.

## 4. Astro must filter future posts

Your Astro blog code must exclude posts whose `publishAt` timestamp is still in the future.

For example:

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

Apply the same rule anywhere published posts are generated, especially:

```text
src/pages/blog/index.astro
src/pages/blog/[slug].astro
src/pages/rss.xml.ts
```

Also check homepage or other components that display recent blog posts.

## 5. Create the deployment script

Inside the portfolio repository, create:

```text
scripts/publish-scheduled-posts.sh
```

Recommended version:

```bash
#!/usr/bin/env bash

set -euo pipefail

APP_DIR="/srv/portfolio"
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

echo "[portfolio-publish] Completed at $(date --iso-8601=seconds)"
```

Replace:

```text
/srv/portfolio
```

with the real absolute path of your repository.

If your normal deployment command is more specific, for example:

```bash
docker compose build portfolio
docker compose up -d --no-deps portfolio
```

use that instead. Scheduled publishing should use the same deployment procedure you already trust.

## 6. Make the script executable

```bash
chmod +x /srv/portfolio/scripts/publish-scheduled-posts.sh
```

Verify:

```bash
ls -l /srv/portfolio/scripts/publish-scheduled-posts.sh
```

You should see executable permissions such as:

```text
-rwxr-xr-x
```

## 7. Test the script manually first

Before using systemd:

```bash
cd /srv/portfolio
./scripts/publish-scheduled-posts.sh
```

Then verify:

```bash
docker compose ps
```

If this script does not work manually, fix it before configuring the systemd timer.

## 8. Create the systemd service

Create:

```text
/etc/systemd/system/portfolio-publish.service
```

For example:

```bash
sudo nano /etc/systemd/system/portfolio-publish.service
```

Use:

```ini
[Unit]
Description=Publish scheduled Astro blog posts
After=network-online.target docker.service
Wants=network-online.target
Requires=docker.service

[Service]
Type=oneshot

User=YOUR_USER
Group=YOUR_USER

WorkingDirectory=/srv/portfolio
ExecStart=/srv/portfolio/scripts/publish-scheduled-posts.sh

TimeoutStartSec=30min

StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Replace:

```text
YOUR_USER
```

with the Linux account that owns and normally deploys the portfolio.

For example:

```ini
User=albert
Group=albert
```

Do not use:

```ini
User=$USER
```

inside a unit file.

Also replace every occurrence of `/srv/portfolio` with your actual repository path.

## 9. Docker permissions

The service user must be able to run Docker.

Test:

```bash
sudo -u YOUR_USER docker ps
```

Check groups:

```bash
groups YOUR_USER
```

If needed:

```bash
sudo usermod -aG docker YOUR_USER
```

After changing group membership, log out and back in or restart the relevant session.

## 10. Create the systemd timer

Create:

```text
/etc/systemd/system/portfolio-publish.timer
```

Recommended weekly configuration:

```ini
[Unit]
Description=Run scheduled Astro blog publication

[Timer]
OnCalendar=Tue *-*-* 08:05:00 Europe/Madrid
Persistent=true
AccuracySec=1min
Unit=portfolio-publish.service

[Install]
WantedBy=timers.target
```

This runs every Tuesday at approximately 08:05 in the `Europe/Madrid` timezone.

A post can therefore use:

```yaml
publishAt: 2026-09-15T08:00:00+02:00
```

and the static site rebuild begins a few minutes later.

## 11. Why `Persistent=true` matters

Keep:

```ini
Persistent=true
```

If the VPS is offline when the timer should run, systemd will run the missed timer after the server comes back.

Without `Persistent=true`, a scheduled publication could be skipped.

## 12. Why `AccuracySec=1min` is useful

```ini
AccuracySec=1min
```

keeps execution close to the scheduled time while still allowing normal systemd timer behavior.

Do not add `RandomizedDelaySec` if you want predictable publication timing.

## 13. Reload systemd

After creating or changing a service or timer:

```bash
sudo systemctl daemon-reload
```

## 14. Test the service manually

Start it:

```bash
sudo systemctl start portfolio-publish.service
```

Check status:

```bash
sudo systemctl status portfolio-publish.service
```

View logs:

```bash
sudo journalctl -u portfolio-publish.service
```

Recent logs only:

```bash
sudo journalctl -u portfolio-publish.service -n 100 --no-pager
```

Follow logs:

```bash
sudo journalctl -u portfolio-publish.service -f
```

A successful `Type=oneshot` service usually finishes and becomes inactive again. That is normal.

## 15. Enable and start the timer

```bash
sudo systemctl enable --now portfolio-publish.timer
```

Check it:

```bash
systemctl status portfolio-publish.timer
```

List timers:

```bash
systemctl list-timers --all
```

Or only this timer:

```bash
systemctl list-timers portfolio-publish.timer
```

## 16. Verify the next execution time

Use:

```bash
systemctl show portfolio-publish.timer   --property=NextElapseUSecRealtime   --property=LastTriggerUSec
```

Validate the calendar expression:

```bash
systemd-analyze calendar 'Tue *-*-* 08:05:00 Europe/Madrid'
```

Always verify the next occurrence after changing `OnCalendar`.


## 16A. Recommended validation sequence after any service/timer change

After editing either:

```text
/etc/systemd/system/portfolio-publish.service
/etc/systemd/system/portfolio-publish.timer
```

run this complete validation sequence:

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

What to expect:

```text
systemd-analyze verify
    ↓
No portfolio-specific syntax/path errors

portfolio-publish.service
    ↓
Result=success
ExecMainStatus=0

journalctl
    ↓
Deployment script completes successfully

portfolio-publish.timer
    ↓
Active and waiting for the next scheduled run
```

Because `portfolio-publish.service` is a `Type=oneshot` service, it can show as:

```text
inactive (dead)
```

after a successful run. That is normal. The important values are:

```text
Result=success
ExecMainStatus=0
```

`systemd-analyze verify` may also print warnings for unrelated system services. For example:

```text
/usr/lib/systemd/system/xfs_scrub_all.service:
Support for option CPUAccounting= has been removed and it is ignored

/usr/lib/systemd/system/system-xfs_scrub.slice:
Support for option CPUAccounting= has been removed and it is ignored
```

These warnings are unrelated to `portfolio-publish.service` and do not indicate a problem with the portfolio deployment.


## 17. Recommended publishing schedule

A good portfolio cadence is:

```text
Tuesday 08:00  article publishAt
Tuesday 08:05  systemd rebuild
```

Timer:

```ini
OnCalendar=Tue *-*-* 08:05:00 Europe/Madrid
```

Article:

```yaml
publishAt: 2026-09-15T08:00:00+02:00
draft: false
```

You can commit several future posts in advance. Only posts whose `publishAt` timestamp has passed will be included in a build.

## 18. Alternative schedules

### Every day

```ini
OnCalendar=*-*-* 08:05:00 Europe/Madrid
```

### Every Monday

```ini
OnCalendar=Mon *-*-* 08:05:00 Europe/Madrid
```

### Every Tuesday

```ini
OnCalendar=Tue *-*-* 08:05:00 Europe/Madrid
```

### Every weekday

```ini
OnCalendar=Mon..Fri *-*-* 08:05:00 Europe/Madrid
```

## 19. Publishing every two weeks

A true "every other Tuesday forever" schedule is less convenient in systemd calendar syntax.

The simplest setup is still:

```ini
OnCalendar=Tue *-*-* 08:05:00 Europe/Madrid
```

and use `publishAt` on every second Tuesday.

The timer rebuilds about 52 times per year, while only the Tuesdays containing a scheduled post change the blog.

That is simpler than adding extra calendar logic just to avoid around 26 small static builds per year.

## 20. Test a future publication

Create a temporary test article:

```yaml
---
title: "Scheduled Publishing Test"
description: "Temporary test post."
date: 2026-09-08
publishAt: 2026-09-08T08:00:00+02:00
tags: ["Test"]
draft: false
featured: false
---
```

Build before the timestamp:

```bash
npm run build
```

The article should not be generated.

Then temporarily set `publishAt` to a timestamp in the past and rebuild.

The article should now appear.

Remove the test article afterward.

## 21. Test the timer without waiting a week

Normally you should test the service directly:

```bash
sudo systemctl start portfolio-publish.service
```

If you specifically want to test timer triggering, temporarily change the timer to:

```ini
[Timer]
OnCalendar=*-*-* *:*:00
Persistent=true
Unit=portfolio-publish.service
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl restart portfolio-publish.timer
```

After the test, restore:

```ini
OnCalendar=Tue *-*-* 08:05:00 Europe/Madrid
```

and reload/restart again.

Do not leave the one-minute test schedule enabled.

## 22. Change the schedule later

Edit:

```bash
sudo nano /etc/systemd/system/portfolio-publish.timer
```

Change `OnCalendar`, then run:

```bash
sudo systemctl daemon-reload
sudo systemctl restart portfolio-publish.timer
```

Verify:

```bash
systemctl list-timers portfolio-publish.timer
```

## 23. Disable automatic publishing

```bash
sudo systemctl disable --now portfolio-publish.timer
```

The service can still be launched manually:

```bash
sudo systemctl start portfolio-publish.service
```

Re-enable it with:

```bash
sudo systemctl enable --now portfolio-publish.timer
```

## 24. Verify timer state

Enabled:

```bash
systemctl is-enabled portfolio-publish.timer
```

Expected:

```text
enabled
```

Active:

```bash
systemctl is-active portfolio-publish.timer
```

Expected:

```text
active
```

## 25. Inspect publication history

All runs:

```bash
sudo journalctl -u portfolio-publish.service
```

Current boot:

```bash
sudo journalctl -u portfolio-publish.service -b
```

Since a date:

```bash
sudo journalctl   -u portfolio-publish.service   --since "2026-09-01"
```

Latest 200 lines:

```bash
sudo journalctl   -u portfolio-publish.service   -n 200   --no-pager
```

## 26. Optional health check

At the end of the deployment script you can check the live site:

```bash
curl   --fail   --silent   --show-error   --location   --max-time 20   https://albertqueralto.dev/   > /dev/null
```

A failed health check makes the script exit with an error, which systemd records in the journal.

## 27. Avoid overlapping deployments

The recommended script already uses:

```bash
flock
```

This prevents a manual deployment and a timer-triggered deployment from running at the same time.

## 28. Avoid local uncommitted server changes

The script also checks:

```bash
git status --porcelain
```

and aborts if the VPS repository contains local modifications.

This keeps scheduled deployment predictable.

## 29. Troubleshooting


## 29A. Fix: `Assignment outside of section. Ignoring.`

If you see:

```text
/etc/systemd/system/portfolio-publish.service:1:
Assignment outside of section. Ignoring.
```

the service file is malformed.

A systemd unit must begin with a valid section header such as:

```ini
[Unit]
```

Do not start the file directly with:

```ini
Description=...
```

Also make sure you did not accidentally paste Markdown code fences such as:

```text
```ini
```

into the actual unit file.

Open the service:

```bash
sudo nano /etc/systemd/system/portfolio-publish.service
```

A valid file should look like:

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

WorkingDirectory=/ABSOLUTE/PATH/TO/PORTFOLIO
ExecStart=/ABSOLUTE/PATH/TO/PORTFOLIO/scripts/publish-scheduled-posts.sh

TimeoutStartSec=30min
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Then reload systemd:

```bash
sudo systemctl daemon-reload
```

Validate again:

```bash
sudo systemd-analyze verify \
  /etc/systemd/system/portfolio-publish.service \
  /etc/systemd/system/portfolio-publish.timer
```

The `Assignment outside of section` error should be gone.

## 29B. Fix: `Command ... is not executable: No such file or directory`

If you see:

```text
portfolio-publish.service:
Command /portfolio/scripts/publish-scheduled-posts.sh is not executable:
No such file or directory
```

the path in `ExecStart=` is wrong, or the script does not exist at that location.

The path:

```text
/portfolio/scripts/publish-scheduled-posts.sh
```

is only an example. You must use the real absolute path of the portfolio repository on the VPS.

Find the repository path:

```bash
cd /path/to/your/portfolio
pwd
```

For example, if `pwd` returns:

```text
/home/albert/portfolio
```

then the service must contain:

```ini
WorkingDirectory=/home/albert/portfolio
ExecStart=/home/albert/portfolio/scripts/publish-scheduled-posts.sh
```

Do not use:

```ini
WorkingDirectory=~/portfolio
ExecStart=~/portfolio/scripts/publish-scheduled-posts.sh
```

systemd does not expand `~` like an interactive shell.

If you do not know where the script is, find it:

```bash
find /home/albert \
  -name 'publish-scheduled-posts.sh' \
  -type f \
  2>/dev/null
```

Then verify that the exact path exists:

```bash
ls -l /home/albert/portfolio/scripts/publish-scheduled-posts.sh
```

Make it executable:

```bash
chmod +x /home/albert/portfolio/scripts/publish-scheduled-posts.sh
```

Verify the executable bit:

```bash
ls -l /home/albert/portfolio/scripts/publish-scheduled-posts.sh
```

You should see permissions similar to:

```text
-rwxr-xr-x
```

Check the script interpreter:

```bash
head -n 1 /home/albert/portfolio/scripts/publish-scheduled-posts.sh
```

Expected:

```bash
#!/usr/bin/env bash
```

Then run the script as the same user configured in the service:

```bash
sudo -u albert -H \
  /home/albert/portfolio/scripts/publish-scheduled-posts.sh
```

If this succeeds, test the systemd service:

```bash
sudo systemctl daemon-reload
sudo systemctl start portfolio-publish.service
```

Check:

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

If the script is somewhere else, use that exact absolute path in both:

```ini
WorkingDirectory=...
ExecStart=...
```

## 29C. Quick path verification checklist

Before starting the service, run:

```bash
systemctl show portfolio-publish.service \
  -p User \
  -p Group \
  -p WorkingDirectory \
  -p ExecStart
```

Then verify the script directly:

```bash
ls -l /ABSOLUTE/PATH/TO/PORTFOLIO/scripts/publish-scheduled-posts.sh
```

Then run it as the service user:

```bash
sudo -u albert -H \
  /ABSOLUTE/PATH/TO/PORTFOLIO/scripts/publish-scheduled-posts.sh
```

This catches most path, permission, Docker, and Git problems before waiting for the timer.



### Timer is not listed

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now portfolio-publish.timer
systemctl list-timers --all
```

### Timer runs but service fails

```bash
sudo systemctl status portfolio-publish.service
sudo journalctl -u portfolio-publish.service -n 200 --no-pager
```

### Docker permission denied

```bash
sudo -u YOUR_USER docker ps
groups YOUR_USER
```

### Git pull fails

```bash
sudo -u YOUR_USER git -C /srv/portfolio pull --ff-only
```

Common causes:

- repository authentication;
- missing SSH key for the service user;
- local uncommitted changes;
- wrong repository path;
- wrong ownership.

### Article does not appear

Check frontmatter:

```yaml
draft: false
publishAt: 2026-09-15T08:00:00+02:00
```

Check server time:

```bash
date
date --iso-8601=seconds
timedatectl
```

Check latest commit:

```bash
cd /srv/portfolio
git log -1 --oneline
```

Run manually:

```bash
sudo systemctl start portfolio-publish.service
```

Inspect logs:

```bash
sudo journalctl -u portfolio-publish.service -n 200 --no-pager
```

### Article appears too early

Find every blog collection query:

```bash
grep -R 'getCollection("blog"' -n src
```

Make sure future-post filtering is applied to every public output.

## 30. Security recommendations

Do not store GitHub tokens or passwords directly inside the systemd unit.

Prefer SSH deploy keys or existing Git credentials belonging to the deployment user.

Avoid running the publication service as root unless necessary.

The publication service should only need access to:

- the portfolio Git checkout;
- Git;
- Docker;
- the Docker Compose project.

## 31. Complete service file

`/etc/systemd/system/portfolio-publish.service`:

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

WorkingDirectory=/srv/portfolio
ExecStart=/srv/portfolio/scripts/publish-scheduled-posts.sh

TimeoutStartSec=30min

StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Adjust the user and repository path.

## 32. Complete timer file

`/etc/systemd/system/portfolio-publish.timer`:

```ini
[Unit]
Description=Run scheduled Astro blog publication

[Timer]
OnCalendar=Tue *-*-* 08:05:00 Europe/Madrid
Persistent=true
AccuracySec=1min
Unit=portfolio-publish.service

[Install]
WantedBy=timers.target
```

## 33. Initial installation commands

```bash
sudo systemctl daemon-reload
```

Test:

```bash
sudo systemctl start portfolio-publish.service
sudo systemctl status portfolio-publish.service
```

Enable timer:

```bash
sudo systemctl enable --now portfolio-publish.timer
```

Verify:

```bash
systemctl list-timers portfolio-publish.timer
```

## 34. Normal publishing workflow

Create or update the article:

```yaml
date: 2026-09-15
publishAt: 2026-09-15T08:00:00+02:00
draft: false
```

Commit and push:

```bash
git add .
git commit -m "Add scheduled blog post"
git push
```

Before publication:

```text
Git repository: article exists
Live website:   article absent
```

At the next scheduled rebuild:

```text
systemd timer
    ↓
portfolio-publish.service
    ↓
publish-scheduled-posts.sh
    ↓
git pull
    ↓
Astro/Docker rebuild
    ↓
future-date filter reevaluated
    ↓
article included
```

## 35. Final recommended setup

```text
Article release:
Tuesday 08:00 Europe/Madrid

Automatic rebuild:
Tuesday 08:05 Europe/Madrid

Frequency:
once per week

Expected scheduled builds:
about 52/year
```

This gives you scheduled publishing with:

- no hourly polling;
- no CMS;
- no server-side Astro requirement;
- no manual release-day deployment;
- static-site performance;
- missed-timer recovery through `Persistent=true`;
- systemd logging and status inspection;
- predictable publication times.
