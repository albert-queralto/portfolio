---
title: "How I Run Several ML Applications on One Small Server"
description: "How I use Docker, private application networks and a shared Nginx edge to operate several ML and SaaS projects on one 8 GB VPS without turning it into a miniature Kubernetes cluster."
date: 2026-12-22
publishAt: 2026-12-22T08:00:00+02:00
tags: ["DevOps", "Docker", "Nginx", "Machine Learning", "SaaS", "Infrastructure"]
draft: false
cover: "/og/running-several-ml-applications-small-server.png"
featured: false
---

My portfolio looks like a collection of independent applications.

Operationally, several of them share one physical constraint:

the same server.

The machine has **8 GB of RAM and 80 GB of disk**.

It needs to serve a portfolio site while also supporting applications such as Payrithm and TenderWise, including APIs, PostgreSQL databases, Redis queues, Celery workers and scheduled jobs.

I could solve this by giving every project a separate cloud environment.

For my current scale, that would add cost and operational complexity faster than it would add value.

Instead, I use a deliberately simple architecture.

## One public edge

The server exposes a shared Nginx reverse proxy.

Conceptually:

```text
Internet
    |
    v
Nginx + Certbot
    |
    +-- albertqueralto.dev
    |
    +-- payrithm.albertqueralto.dev
    |
    +-- tenderwise.albertqueralto.dev
```

Nginx handles:

- TLS,
- host routing,
- proxy headers,
- HTTP configuration,
- and public entry points.

The applications do not each need to solve public TLS independently.

That also gives me one obvious place to inspect incoming traffic and certificate configuration.

## Each application remains its own stack

Sharing a server does not mean running everything in one giant Docker Compose file.

I prefer each application to own its services.

For example:

```text
TenderWise
    |
    +-- web
    +-- API
    +-- PostgreSQL
    +-- Redis
    +-- Celery
    +-- Celery Beat
    +-- backup service
```

while Payrithm can evolve independently with its own stack.

This preserves an important property:

> I can deploy one application without conceptually deploying the server.

The shared edge is infrastructure.

The application Compose project is the product.

## Only the public service joins the proxy network

For TenderWise, only the web-facing container needs to communicate with the public Nginx edge.

Internally:

```text
public proxy network
        |
        v
TenderWise web
        |
        v
private TenderWise network
        |
        +-- API
        +-- PostgreSQL
        +-- Redis
        +-- Celery
        +-- scheduler
        +-- backups
```

PostgreSQL does not need to bind a public host port.

Redis does not need one either.

Neither do the workers.

The same pattern applies to other applications.

This dramatically reduces the number of services exposed by the host.

## Containers are isolation, not magic

Docker makes application dependencies easier to separate.

It does not create extra RAM.

Every container still shares the underlying machine.

That means I need to think globally about:

```text
CPU
memory
disk
network
```

even though deployment is separated by project.

This becomes particularly visible with background workers.

Payrithm and TenderWise can both be perfectly configured individually and still contend for the same physical CPU.

Capacity planning therefore exists at two levels:

```text
inside each application
and
across the entire host
```

## Stateful services need special treatment

Stateless frontend and API containers are relatively easy to recreate.

PostgreSQL is different.

Application containers can disappear.

Database volumes cannot casually disappear with them.

I therefore treat:

- database volumes,
- backup files,
- and uploaded or persistent data

as infrastructure that deserves an explicit lifecycle.

Backups also create another small-server problem: disk usage.

If I retain every backup forever, a working backup strategy eventually becomes a disk-exhaustion strategy.

Retention matters.

## Docker images also consume the 80 GB disk

Frequent deployments leave layers behind.

Over time the host can contain:

```text
old images
unused build cache
stopped containers
application logs
database backups
database growth
```

Disk monitoring is therefore as important as CPU monitoring.

A service can have available RAM and still fail because PostgreSQL cannot extend a file on a full disk.

Maintenance needs mundane jobs such as:

```text
rotate logs
expire old backups
remove unused Docker images
monitor volume growth
```

Those tasks are not glamorous.

They are production engineering.

## I prefer explicit private networks

Multiple Compose projects create opportunities for accidental coupling.

A service in Payrithm should not be able to address TenderWise's database simply because both happen to be Docker containers.

Private per-application networks provide a useful default boundary.

The architecture becomes:

```text
                 shared proxy network
                 /                 \
                /                   \
        Payrithm web          TenderWise web
             |                      |
      private network        private network
             |                      |
      internal services      internal services
```

Shared infrastructure is explicit.

Everything else is isolated by default.

## Background processing is the hardest shared resource

Static pages are cheap.

HTTP requests are usually short.

Background workloads can occupy resources for much longer.

Examples include:

- procurement synchronization,
- document processing,
- ML training,
- AI generation,
- and scheduled analytics.

This makes workers the area where I am most careful about resource budgets.

If several applications decide to perform expensive background work simultaneously, no amount of Docker isolation changes the fact that they share the same CPU and RAM.

This is why I care about:

- Celery concurrency,
- queue depth,
- task scheduling,
- worker health,
- and database connection pools

at the host level.

## Scheduling can reduce contention

Not every job needs to run immediately.

Scheduled maintenance, backups and ingestion can sometimes be spread across different time windows.

For example, I do not need every database backup and every ingestion scheduler to wake up at exactly the same minute.

Staggering recurring workloads is a simple form of capacity management.

On a large cluster this may barely matter.

On an 8 GB host it can.

## Observability does not need to start with a giant platform

My current goal is not to reproduce the observability stack of a hyperscale company.

I need enough visibility to answer practical questions:

```text
Is the server running out of memory?
Is disk filling?
Is PostgreSQL healthy?
Is Redis reachable?
Are Celery workers alive?
Is a queue growing?
Are HTTP requests becoming slow?
Did a scheduled job fail?
```

Application-level health endpoints, worker heartbeats, Docker logs and host metrics can answer many of these questions.

The observability stack should be proportional to the system.

## When should the server become larger?

Running several applications on one host is not a permanent architectural ideology.

It is a cost/complexity decision.

I would consider separating workloads when signals such as these become persistent:

```text
memory pressure despite optimization
CPU contention affecting interactive traffic
database load requiring independent scaling
AI workloads dominating host capacity
different availability requirements
large customer or data growth
maintenance of one app affecting another
```

At that point the architecture can evolve.

For example:

```text
shared server
      |
      +--> dedicated database
      |
      +--> dedicated worker machine
      |
      +--> separate application hosts
```

The existing Docker boundaries make that migration easier because the applications already communicate through service interfaces.

## Small infrastructure is still real infrastructure

Operating on one VPS can sometimes be dismissed as "not production" compared with a cloud cluster.

I think that misses the interesting engineering problem.

The server still needs:

```text
TLS
network isolation
persistent storage
backups
background processing
databases
deployment
monitoring
failure recovery
resource management
```

The scale is smaller.

The responsibilities are real.

In fact, the constraint makes architectural mistakes visible quickly.

A badly bounded worker pool consumes all available RAM.

An unlimited database pool creates connection pressure.

Forgotten Docker images fill the disk.

A publicly exposed Redis instance creates an unnecessary security risk.

There is little excess capacity to hide those decisions.

## The architecture I want is boring

The final goal is not to show how many infrastructure technologies I can operate.

It is:

```text
git push / deploy
       |
       v
application starts
       |
       v
Nginx routes traffic
       |
       v
private services communicate
       |
       v
background jobs execute
       |
       v
state is backed up
```

When something fails, I want to know which boundary owns the problem.

A small server rewards that simplicity.

Running several ML applications on 8 GB is possible not because the machine is unusually powerful, but because the architecture avoids pretending every project needs hyperscale infrastructure.

For the scale I am currently building at, that trade-off gives me something more valuable than a complicated platform:

a production environment I understand end to end.
