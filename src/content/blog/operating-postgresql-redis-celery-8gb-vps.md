---
title: "Operating PostgreSQL, Redis and Celery on an 8 GB VPS"
description: "What running PostgreSQL, Redis, Celery workers and multiple SaaS applications on an 8 GB VPS taught me about resource budgets, concurrency, queues and operational simplicity."
date: 2026-09-05
tags: ["DevOps", "PostgreSQL", "Redis", "Celery", "Docker", "Production"]
draft: false
cover: "/og/operating-postgresql-redis-celery-8gb-vps.png"
featured: false
---

Running a machine-learning application in production usually involves much more than serving a model.

My applications use PostgreSQL for persistent state, Redis for coordination, Celery for asynchronous work, FastAPI for APIs, React for user-facing interfaces, and Docker to package the services. TenderWise also runs scheduled procurement ingestion and optional AI workloads. Payrithm adds asynchronous processing around invoices, prediction workflows and collection operations.

The interesting constraint is that I do not run these systems on a large Kubernetes cluster.

I run them on a relatively small VPS with **8 GB of RAM and 80 GB of storage**.

That constraint has been useful. It forces me to think about resource consumption instead of hiding inefficiency behind a larger machine.

The central lesson has been simple:

> On a small server, capacity planning is part of application architecture.

## The architecture

At the public edge I use a shared Nginx and Certbot setup.

Conceptually, the server looks like this:

```text
Internet
    |
    v
Nginx + TLS
    |
    +---- Portfolio
    |
    +---- Payrithm
    |       |
    |       +-- FastAPI
    |       +-- PostgreSQL
    |       +-- Redis
    |       +-- Celery
    |
    +---- TenderWise
            |
            +-- FastAPI
            +-- PostgreSQL
            +-- Redis
            +-- Celery
            +-- Celery Beat
            +-- backup jobs
```

The public reverse proxy knows how to route domains. The application databases do not need to.

Only the services that need external traffic join the public proxy network. PostgreSQL, Redis and background workers remain on private Docker networks.

That gives me a useful security and operational boundary: a database does not need a host port simply because the application using it is public.

## Eight gigabytes is not eight gigabytes for Celery

A common mistake when sizing background workers is to look at the machine and think:

```text
8 GB RAM
therefore
plenty of room for workers
```

But the worker pool is only one consumer.

Memory is also needed by:

- the operating system,
- Docker,
- PostgreSQL,
- Redis,
- FastAPI processes,
- frontend containers,
- Nginx,
- scheduled jobs,
- backups,
- and filesystem cache.

If an optional local AI model is running, the calculation changes even more dramatically.

The right question is therefore not:

> How many Celery workers can I start?

It is:

> How much memory and CPU can background processing consume without degrading the interactive application?

That distinction matters.

## PostgreSQL needs a connection budget too

Celery concurrency does not only consume CPU and memory. It can also multiply database connections.

Imagine an API service with its own SQLAlchemy connection pool and several Celery processes that can independently open database connections.

Increasing worker concurrency from four to eight can potentially double the number of simultaneous database consumers.

If several applications share the same server, this multiplication happens independently in every stack.

So when changing Celery concurrency I also think about:

```text
worker processes
×
possible DB connections per process
+
API connection pools
+
administrative/background connections
```

PostgreSQL is extremely reliable, but opening arbitrary numbers of connections is not free.

On a small machine, deliberately modest pools are often better than large defaults.

## Redis should coordinate work, not become the work

Redis is lightweight compared with many services, but it is easy to forget that queue state also consumes memory.

If producers can enqueue jobs faster than workers can process them, the queue becomes a storage system for unfinished work.

That is usually a signal that something else is wrong.

A healthy asynchronous architecture needs some form of backpressure.

For example, a scheduled ingestion job should not continuously create thousands of duplicate tasks because the previous cycle has not finished.

I prefer idempotent scheduled tasks and observable queue state.

For TenderWise, failed procurement notices also have persistent retry state in PostgreSQL. That means Redis does not need to become the durable record of what failed and why.

The database can preserve fields such as:

```text
notice
attempt count
last error
status
next retry time
```

Celery is responsible for executing the retry.

That separation makes recovery much easier to reason about.

## Not all background jobs are equal

One reason Celery capacity becomes difficult is that task durations can be radically different.

TenderWise uses asynchronous processing for work such as:

- TED synchronization,
- failed-notice retries,
- expired-opportunity maintenance,
- email delivery,
- scheduled digests,
- AI tender briefs,
- and worker health recording.

An email task and an AI-generation task should not be treated as equivalent workloads.

Likewise, downloading and parsing a large procurement notice can occupy a worker much longer than updating a heartbeat.

A useful mental model is:

```text
SHORT
email
notifications
small updates

MEDIUM
normalization
scoring
scheduled cleanup

LONG
bulk ingestion
model training
AI generation
```

Once workloads are classified this way, worker capacity becomes easier to design.

Queue separation can then be introduced where necessary:

```text
Redis
 |
 +-- default ------> general workers
 |
 +-- ingestion ----> ingestion workers
 |
 +-- ml/ai --------> expensive workers
```

The exact topology depends on workload. The important point is that a long-running job should not unnecessarily prevent a short, user-visible job from running.

## Increasing concurrency can make the system slower

The most obvious response to worker saturation is simply:

> Add more workers.

Sometimes that is correct.

But increasing concurrency can also create:

- more CPU contention,
- more database connections,
- more simultaneous network requests,
- more memory pressure,
- and more context switching.

A worker pool is therefore a resource-allocation decision rather than a speed slider.

The experiment I care about is not only:

```text
tasks / second
```

It is:

```text
background throughput
while
API latency remains acceptable
and
memory remains stable
```

Those constraints need to be measured together.

> **Measurement to add before publishing:** compare worker concurrency, queue wait time, API p95 latency and RAM usage for at least two configurations.

## Watch queue age, not only CPU

CPU usage tells me whether the machine is busy.

It does not tell me whether users are waiting for work.

For asynchronous systems I care about:

- queue depth,
- oldest queued task age,
- task runtime,
- task failure rate,
- worker heartbeat,
- and retry count.

A queue containing 200 tasks may be fine if they take 20 milliseconds each.

Five queued tasks may be a problem if each requires ten minutes.

The age of the oldest unfinished task is often more useful than raw queue length.

## Disk is part of the capacity model

The VPS also has a finite 80 GB disk.

Databases grow. Docker images accumulate. Logs grow. Backups grow. Old build layers remain unless they are cleaned.

Production therefore requires mundane controls:

```text
log rotation
backup retention
Docker image cleanup
database monitoring
disk-usage alerts
```

A machine with available RAM can still fail spectacularly because PostgreSQL reaches a full filesystem.

## What I learned

The server has changed how I think about production architecture.

I no longer treat PostgreSQL, Redis and Celery as independent technologies.

They form a resource system.

Increasing one part changes pressure elsewhere.

More Celery concurrency can mean more PostgreSQL connections. Faster ingestion can mean larger queues and faster database growth. More logging can improve debugging while consuming disk.

The goal is therefore not maximum utilization.

It is predictable utilization.

For small production systems, that is often a better engineering objective than trying to reproduce the architecture of a company operating hundreds of servers.

A modest VPS can run surprisingly capable applications.

But only if every service remembers that it shares the machine.
