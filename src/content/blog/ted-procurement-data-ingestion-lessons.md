---
title: "What Went Wrong While Ingesting TED Procurement Data"
description: "The data-model and reliability problems that shaped TenderWise's TED ingestion pipeline, from notice versions and lots to multilingual fields, retries and semi-structured qualification criteria."
date: 2026-10-01
tags: ["Data Engineering", "ETL", "PostgreSQL", "Celery", "Procurement", "SaaS"]
draft: false
cover: "/og/ted-procurement-data-ingestion-lessons.png"
featured: false
project: "tenderwise"
---

When I started building **TenderWise**, ingesting European procurement notices looked like the easy part.

Search TED, retrieve a notice, parse some fields, save them to PostgreSQL.

Then score the opportunity.

The more I worked with the source data, the more obvious it became that the ingestion layer was not a plumbing detail.

It was part of the product's decision model.

If the source is interpreted incorrectly, everything downstream can be confidently wrong.

These are the failure modes that changed the architecture.

## Problem 1: a search result is not the source of truth

TenderWise uses the TED Search API to discover notices.

But discovery data is not enough for the full assessment.

I therefore treat the canonical TED XML as the authoritative source for opportunity details.

The pipeline became:

```text
TED Search API
    |
publication number
    |
    v
canonical XML
    |
    v
checksum
    |
    v
source version
    |
    v
normalization
    |
    v
opportunity
```

The distinction matters because TenderWise needs more than a title and deadline.

It needs source evidence for things like:

- CPV codes,
- countries,
- contract value,
- lots,
- selection criteria,
- and qualification requirements.

## Problem 2: notices change

A procurement notice is not necessarily immutable.

Corrections and later versions can modify useful details.

Simply overwriting the previous database row would destroy the history explaining why a recommendation changed.

TenderWise therefore calculates a SHA-256 checksum for canonical source content.

Conceptually:

```python
checksum = sha256(xml_payload.encode("utf-8")).hexdigest()
```

If the checksum already exists for the publication number, the ingestion path can avoid unnecessary reprocessing.

If it differs, the application can store a new source version.

That gives the system provenance:

```text
recommendation
    |
based on
    |
opportunity state
    |
derived from
    |
specific source-notice version
```

That becomes particularly important when a user asks why yesterday's assessment is different from today's.

## Problem 3: one notice can contain multiple opportunities

My first mental model was too notice-centric.

A TED notice can describe multiple lots.

Those lots may differ in scope, value, geography or requirements.

Treating the entire notice as a single opportunity can therefore combine facts that should remain separate.

TenderWise's internal model became lot-oriented.

A normalized lot contains fields such as:

```text
lot ID
title
description
buyer
countries
CPV codes
estimated value
currency
deadline
source language
requirements
```

The ingestion unit is no longer:

> I downloaded a notice.

It is:

> I produced one or more normalized commercial opportunities from a versioned notice.

## Problem 4: geography is not one clean code

The UI and company profiles should not need to understand every representation used by an upstream dataset.

Downstream logic should not care whether a source uses one country-code representation while the application expects another.

That conversion belongs in normalization.

This sounds trivial, but normalization errors are particularly dangerous because they produce silent mismatches.

A company can configure Spain as a target country and still miss Spanish opportunities if the two layers disagree about country representation.

The same general rule applies beyond geography:

> External variability should stop at the ingestion boundary.

## Problem 5: CPV codes are hierarchical

CPV matching is also more subtle than equality.

A company interested in a broader service family should not necessarily miss a notice simply because the notice uses a more specific descendant code.

TenderWise therefore normalizes CPV values and allows meaningful family-prefix matching.

The practical implication is that a broader configured family can match a more specific notice classification within that family.

Exact-string matching would produce false negatives.

Naively matching every prefix, on the other hand, would produce too many false positives.

Domain hierarchy belongs in the matching logic.

## Problem 6: multilingual text needs deterministic fallback rules

TED is multilingual.

A field I want in one language may be absent while another localized representation exists.

That means normalization requires an explicit preference and fallback strategy.

The important part is not attempting a magical translation at ingestion time.

It is making sure the scoring layer receives a predictable field.

I want downstream code to consume:

```python
opportunity.title
```

rather than understand all the possible XML paths and language alternatives that produced it.

## Problem 7: qualification criteria are only partly structured

Some of the most commercially important tender information appears in natural-language selection criteria.

Examples include:

- minimum annual turnover,
- minimum team size,
- ISO certification,
- and number of comparable contracts.

Some of these can be safely converted into structured requirements.

Others cannot.

The dangerous approach would be to force every sentence into a structured value.

TenderWise instead keeps the original description and source path, and where confidence is sufficient, also creates a structured requirement.

When a rule cannot be extracted reliably, it becomes manual-review evidence.

That is deliberately less ambitious than pretending the parser understands everything.

## Problem 8: unknown is not zero

Missing information creates another subtle ingestion problem.

Suppose a contract value is absent.

That does not mean:

```text
contract value = 0
```

Likewise, an unparseable qualification criterion does not mean that the company fails it.

TenderWise preserves unknown states and warnings.

This matters downstream because:

```text
FAIL
```

and:

```text
UNKNOWN
```

lead to very different procurement decisions.

## Problem 9: transient failures cannot make tenders disappear

Network requests fail. External XML endpoints fail. Unexpected documents appear. Parsing bugs happen.

A production ingestion system cannot silently skip those records.

TenderWise persists failed-ingestion state with information such as:

```text
attempt count
error
status
next retry time
```

Retries use bounded exponential backoff rather than hammering an already failing upstream system.

Conceptually:

```text
attempt 1 -> 1 hour
attempt 2 -> 2 hours
attempt 3 -> 4 hours
...
capped at a maximum interval
```

This gives failures a visible lifecycle.

A broken download becomes an operational object that can be inspected and retried rather than a missing tender no one knows existed.

## Problem 10: idempotency matters

Scheduled synchronization will revisit the same procurement universe repeatedly.

That means the pipeline must tolerate repetition.

Running ingestion twice should not create two copies of the same lot.

Reprocessing identical XML should not create artificial versions.

Retrying after a worker crash should not leave contradictory records.

Checksums, stable source identifiers and database upserts are therefore not optimization details.

They are correctness mechanisms.

## What changed in my thinking

I initially thought the interesting part of TenderWise would begin after ingestion:

```text
matching
scoring
BID / REVIEW / NO_BID
```

In reality, the quality of those decisions depends heavily on what happens before them.

The ingestion system determines:

- what an opportunity is,
- which source version it represents,
- which data is known,
- which data is unknown,
- and whether a failure remains recoverable.

The final architecture is therefore much more explicit:

```text
TED Search
    -> canonical source retrieval
    -> version detection
    -> lot normalization
    -> requirement extraction
    -> persistent opportunity
    -> discovery matching
    -> relevance
    -> qualification
```

That architecture is less convenient than saving a search response directly to a database.

It is also far easier to trust.

The main lesson I took from TED ingestion is that external data should not be allowed to leak its inconsistencies through the rest of the application.

Normalization is where uncertainty becomes explicit.

And in a decision-support system, explicit uncertainty is far safer than fake precision.
