---
title: "TenderWise"
description: "A multilingual procurement SaaS that ingests TED notices, scores opportunities against company profiles, separates relevance from qualification, and coordinates bid preparation."
order: 2
featured: true
draft: false
status: "Deployed"
category: "Web"
focus: "Procurement SaaS · Decision support"
image: "/projects/tenderwise/tenderwise.png"
source: "https://github.com/albert-queralto/tender-wise"
preview: "https://tenderwise.albertqueralto.dev/"
technologies:
  - React
  - TypeScript
  - Vite
  - FastAPI
  - PostgreSQL
  - pgvector
  - Redis
  - Celery
  - Docker
  - Stripe
  - Ollama
metrics:
  - label: "Domain"
    value: "European public procurement"
  - label: "Decision model"
    value: "Relevance + qualification"
  - label: "Architecture"
    value: "Multi-service SaaS"
---

## The problem

Public procurement teams need to decide quickly whether a tender deserves a
bid, but the source material is dense, multilingual, and operationally
awkward.

TED notices contain valuable signals about scope, location, CPV categories,
deadlines, buyer context, contract value, and mandatory requirements. TenderWise
turns that stream into a workspace where teams can decide what to pursue and
coordinate the work required to prepare a bid.

## My approach

TenderWise separates discovery, decision support, and bid execution.

The system ingests TED notices, normalizes them into structured opportunities,
matches them against company profiles, and then evaluates two different
questions:

- Is the opportunity strategically relevant?
- Can the company satisfy the known mandatory requirements?

Those axes feed a deterministic `BID`, `REVIEW`, or `NO_BID` recommendation.
AI can explain and summarize tender content, but it does not override the
rules-based recommendation.

## TED ingestion

The backend integrates with the TED Search API and stores canonical TED XML so
notice history remains traceable. Parsed records become normalized lots and
opportunities that can be filtered by geography, CPV codes, value preferences,
deadlines, source, status, and watchlist state.

TenderWise also stores notice versions and failed-ingestion state. That allows
the platform to retry transient errors and highlight changes when a source
notice evolves.

## Relevance and qualification

Company profiles define what matters to a workspace: target countries, CPV
preferences, exclusions, contract values, capabilities, certifications, and
other qualification evidence.

Relevance scoring answers whether the opportunity belongs in the team's feed.
Qualification scoring answers whether the team appears able to satisfy the
mandatory requirements already extracted from the notice.

Keeping those concepts separate makes the recommendation easier to audit. A
tender can be strategically attractive but still require review because a
mandatory requirement is unknown or missing.

## Bid workspace

Once an opportunity is worth pursuing or reviewing, TenderWise creates a
collaborative bid workspace.

The workspace tracks workflow stages, internal deadlines, named bid-team roles,
preparation tasks, seeded requirement checklists, ownership, completion
progress, and team comments. This keeps the decision system connected to the
operational work needed before submission.

## SaaS operations

TenderWise includes the product infrastructure around the workflow:

- Workspace membership and role-based permissions
- First-run onboarding
- Stripe subscription state and usage limits
- Audit logs for mutating workspace actions
- In-app notifications for billing, TED, and bid events
- Production health visibility and scheduled PostgreSQL backups

These pieces make the project more than a tender parser. It behaves like a
maintainable SaaS application with operational boundaries, quotas, and recovery
paths.

## Optional AI briefs

AI tender briefs are queued through Celery instead of blocking the browser.
When enabled, TenderWise can generate an executive summary, key points, risks,
unknowns, suggested next steps, and plain-language requirement explanations.

The AI provider is configurable: a local Ollama container can be used in Docker
Compose, or the worker can call an OpenAI-compatible provider. Cached briefs
are marked stale when the model or provider configuration changes.

## Architecture

The production deployment uses a shared Nginx and Certbot edge stack for
`tenderwise.albertqueralto.dev`.

Behind that public edge, the React application is served by a web container and
proxies API requests to FastAPI. PostgreSQL with pgvector stores application
data, Redis coordinates Celery jobs, Celery Beat schedules background work, and
workers handle TED ingestion, email, digest, retry, and AI-generation tasks.

Only the web service joins the public proxy network. The database, Redis, API,
worker, scheduler, backup process, and optional Ollama service remain on the
private TenderWise Compose network.

## Current status

TenderWise is deployed as a production-oriented SaaS project. The next product
work is to refine onboarding, tune the scoring weights with real users, expand
operational monitoring, and continue improving the bid workspace around how
procurement teams actually prepare submissions.
