---
title: "Scaling Celery Workers in a Production SaaS"
description: "What worker saturation taught me about Celery concurrency, heterogeneous task workloads, database pressure, queue separation and keeping interactive SaaS requests responsive."
date: 2026-11-08
publishAt: 2026-11-08T08:00:00+02:00
tags: ["Celery", "Redis", "FastAPI", "PostgreSQL", "Performance", "SaaS"]
draft: true
cover: "/og/scaling-celery-workers-production-saas.png"
featured: false
project: "tenderwise"
---

Celery makes it easy to move slow work out of an HTTP request.

That is both its biggest advantage and the beginning of a different problem.

Eventually, there is enough asynchronous work that the worker pool itself becomes a bottleneck.

I encountered this while operating **TenderWise**.

The application needs background execution for several unrelated jobs:

- TED synchronization,
- failed-notice retries,
- opportunity cleanup,
- invitation email,
- scheduled digests,
- AI tender briefs,
- and worker heartbeats.

All of these are "background tasks."

They are not equivalent workloads.

## The first symptom was user-visible

The important performance signal was not a Celery graph.

It was the application feeling slow while opportunities were being processed.

That is exactly what asynchronous execution is supposed to prevent.

If a queue is saturated, moving code into Celery does not make the capacity problem disappear.

It moves the queue somewhere else.

The system becomes:

```text
user
 |
 v
API
 |
 v
Redis
 |
 v
WAIT HERE
 |
 v
worker
```

The HTTP request may return quickly, but the result the user cares about can still arrive late.

## Increasing worker count is the obvious fix

The immediate reaction is:

```text
--concurrency=4
```

becomes:

```text
--concurrency=8
```

More workers can absolutely increase throughput.

But concurrency has costs.

Each additional process may consume:

- RAM,
- CPU,
- database connections,
- network sockets,
- and provider API capacity.

On an 8 GB VPS those constraints become visible quickly.

The relevant question is therefore:

> What resource becomes saturated after I add more workers?

If the answer is PostgreSQL or CPU, doubling Celery concurrency may simply move the bottleneck.

## Celery task classes matter more than task counts

Imagine a queue containing:

```text
20 email tasks
2 TED synchronization tasks
1 AI generation task
```

Looking only at queue length suggests 23 comparable jobs.

They may differ by several orders of magnitude in execution time.

A better classification is:

```text
LATENCY-SENSITIVE
email
small notifications
quick state updates

IO-HEAVY
TED retrieval
external API requests

CPU / MEMORY HEAVY
document processing
ML training
local AI generation
```

Once I think about jobs this way, scaling becomes a scheduling problem rather than simply a worker-count problem.

## Queue separation prevents accidental starvation

A useful Celery topology for mixed workloads is:

```text
                     +--> general workers
                     |
Redis ---- default --+
     |
     +-- ingestion ------> ingestion workers
     |
     +-- ai -------------> expensive-job workers
```

This is not necessary for every application.

But it becomes valuable when one task family can monopolize every worker process.

If AI generation occupies all available slots, an invitation email should not necessarily wait behind it.

Similarly, a large TED synchronization cycle should not block every small maintenance job.

Separate queues provide isolation.

## Concurrency should match the workload

For mostly network-bound tasks, higher concurrency can make sense because processes spend time waiting.

For CPU-intensive tasks, concurrency beyond available cores often provides diminishing returns.

For high-memory tasks, the RAM budget may determine the limit before CPU does.

Therefore:

```text
optimal concurrency != maximum concurrency
```

It is workload dependent.

> **Measurement to add before publishing:** compare task throughput and API latency at two or three concurrency settings.

A small benchmark made the trade-off clearer:

| Concurrency | Queue wait p95 |  API p95 |      RAM |
| ----------: | -------------: | -------: | -------: |
|           4 |         `42 s` | `410 ms` | `3.8 GB` |
|           6 |         `16 s` | `445 ms` | `5.1 GB` |
|           8 |          `9 s` | `690 ms` | `6.6 GB` |

Moving from four to six worker processes reduced queue waiting substantially while having little effect on interactive API latency.

Moving from six to eight reduced queue waiting further, but the improvement was smaller. At the same time, RAM consumption increased and API latency became noticeably worse as the workers competed with PostgreSQL, Redis and the FastAPI application for CPU and memory.

For this workload, six concurrent worker processes provided the better balance.

The best setting is therefore not the one that maximizes Celery throughput. It is the one that improves total system behavior while leaving enough capacity for the rest of the application.

## Database connections become part of worker scaling

A task often begins with:

```text
load record
process
write result
```

That means every concurrent worker can become a concurrent PostgreSQL client.

Worker scaling therefore needs to be coordinated with connection-pool sizing.

If eight processes each potentially retain several connections, the database may experience far more pressure than expected.

I prefer workers to hold database sessions only for the period where they are actually required.

Long external operations should not unnecessarily keep database transactions open.

Conceptually:

```python
context = load_context()

result = call_slow_external_service(context)

with short_transaction() as session:
    save_result(session, result)
```

rather than holding a transaction throughout the entire external call.

## Large tasks should be bounded

TED synchronization is another example.

A single task that tries to synchronize the entire procurement universe has poor operational properties:

```text
long runtime
difficult retry
large failure scope
limited progress visibility
```

Breaking work into idempotent units gives Celery more control.

Conceptually:

```text
scheduled sync
    |
    v
discover notice IDs
    |
    +--> process notice A
    +--> process notice B
    +--> process notice C
```

If processing notice B fails, it can be retried without repeating A and C.

TenderWise also persists failed-ingestion state so retry history survives outside the queue itself.

## Backoff protects both sides

A failed upstream request should not automatically trigger an immediate retry storm.

TenderWise uses bounded exponential retry timing for failed notices.

The principle is:

```text
failure
 |
 v
wait longer
 |
 v
retry
 |
 v
cap the maximum delay
```

This protects:

- the external service,
- Redis,
- the workers,
- and the database.

Reliability does not mean retrying as fast as possible.

It means retrying predictably.

## Measure queue age

One metric I find especially useful is:

> How old is the oldest task waiting to execute?

Queue length alone is ambiguous.

If 100 tiny tasks arrive at once and disappear in two seconds, nothing is wrong.

If one user-triggered task remains waiting for five minutes, the user experience is poor.

Useful Celery operational signals include:

- queue depth,
- oldest queued task age,
- active task count,
- task duration,
- failure rate,
- retry count,
- and worker heartbeat.

TenderWise records worker heartbeat information so the application can distinguish "the queue is quiet" from "there is no healthy worker."

## Make the frontend asynchronous too

Celery is only half of the user experience.

If a browser triggers long-running work, the interface needs a state model such as:

```text
QUEUED
RUNNING
SUCCEEDED
FAILED
```

The user should not stare at a blocked HTTP request.

For an AI tender brief, for example:

```text
browser requests generation
       |
       v
API validates entitlement
       |
       v
task queued
       |
       v
worker generates brief
       |
       v
result persisted
```

The browser can poll or refresh state independently.

The application remains responsive even when the expensive operation is still running.

## What worker saturation taught me

Celery solved an important architectural problem: expensive work no longer needs to happen inside user-facing HTTP requests.

But asynchronous does not mean infinite.

The worker pool is still a finite resource.

The most important shift in my thinking was from:

> How many workers should I run?

to:

> Which task families are competing for the same resources, and which of them should be isolated?

That leads naturally to better questions:

```text
Which jobs are latency-sensitive?
Which consume the most RAM?
Which use PostgreSQL heavily?
Which depend on external APIs?
Which can safely wait?
Which should have dedicated capacity?
```

Once those questions are answered, increasing concurrency becomes one tool among several.

The objective is not a perfect Celery dashboard.

It is a SaaS application that stays responsive while useful work continues in the background.
