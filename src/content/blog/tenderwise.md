---
title: "Building TenderWise: Rules-Based Bid/No-Bid Intelligence for European Tenders"
description: "How I designed TenderWise as a multilingual procurement SaaS that ingests TED notices, applies deterministic profile matching, separates relevance from qualification, and turns tender analysis into collaborative bid preparation."
date: 2026-08-10
tags:
  [
    "Software Engineering",
    "FastAPI",
    "React",
    "PostgreSQL",
    "Procurement",
    "SaaS",
  ]
draft: false
cover: "/og/tenderwise.png"
featured: true
project: "tenderwise"
---

Public-procurement software has a different failure mode from many analytics
products.

The hard part is not only finding opportunities. It is helping a team decide
whether a tender is worth the cost of preparing a bid, while preserving enough
evidence that the decision can be reviewed later.

That is the problem behind **TenderWise**, a multilingual SaaS for European
public procurement. It ingests TED notices, normalizes them into structured
opportunities, filters them against company profiles, separates strategic
relevance from qualification readiness, and turns the final decision into a
collaborative bid workspace.

This article walks through the technical design:

1. Normalizing TED notices into opportunities
2. Matching company profiles against countries, CPV codes, and contract values
3. Scoring relevance with active weighted dimensions
4. Evaluating mandatory qualification requirements
5. Producing `BID`, `REVIEW`, and `NO_BID` recommendations
6. Keeping AI summaries subordinate to deterministic rules
7. Connecting the decision to bid execution and SaaS operations

The core idea is simple: when eligibility and bid effort are at stake, a system
should be explainable before it is clever.

## The Product Problem

A procurement team reviewing tenders is usually asking several questions at
once:

- Does this opportunity match our target markets?
- Is the CPV scope relevant to what we sell?
- Is the contract value worth the effort?
- Are there hard exclusions that make the tender irrelevant?
- Do we satisfy mandatory requirements such as turnover, team size, or
  certifications?
- Who needs to prepare the actual response if we decide to bid?

It is tempting to collapse those questions into one score. TenderWise does not.

The system deliberately separates:

- **Discovery matching**: should the opportunity enter the feed at all?
- **Relevance scoring**: is this strategically attractive?
- **Qualification scoring**: can the company satisfy known mandatory criteria?
- **Bid execution**: how does the team prepare the response?

That separation is the architecture.

## TED Notice Normalization

TenderWise uses the TED Search API for discovery, but it treats the canonical
TED XML as the source of truth for opportunity details.

The ingestion flow is:

```text
TED Search API
    -> publication numbers and format links
    -> canonical XML retrieval
    -> checksum and source-version storage
    -> lot-level normalization
    -> requirement extraction
    -> opportunity upsert
    -> watcher notifications when notice content changes
```

Each XML payload receives a SHA-256 checksum. If the checksum already exists for
the publication number, the notice has not changed and ingestion can skip the
expensive path.

```python
import hashlib


def notice_checksum(xml_payload: str) -> str:
    return hashlib.sha256(xml_payload.encode("utf-8")).hexdigest()
```

When the checksum is new, TenderWise stores a `SourceNoticeVersion` record and
normalizes the XML into one or more lots. A single TED notice can describe
multiple lots, so the application model is lot-oriented rather than
notice-oriented.

```python
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal


@dataclass(slots=True)
class NormalizedLot:
    lot_id: str
    title: str
    description: str | None
    buyer_name: str | None
    country_codes: list[str]
    cpv_codes: list[str]
    estimated_value: Decimal | None
    currency: str
    deadline: datetime | None
    source_language: str | None
    requirements: list["ParsedRequirement"] = field(default_factory=list)
```

The normalizer prefers localized text in the source language and falls back when
the preferred field is absent. It also converts TED country codes into the
two-letter codes used by the product UI and company profiles.

This matters because the downstream scoring code should not need to know
whether a notice used `ESP`, `ES`, or a nested XML path. It should receive a
clean opportunity object.

## Parsing Requirements from Tender Text

TenderWise extracts structured qualification requirements from TED selection
criteria. Some requirements can be converted into machine-checkable values:

- minimum annual turnover
- minimum team size
- named certifications such as ISO standards
- minimum comparable-contract counts

The parser still keeps the original description and source path because not
every procurement requirement can be trusted as fully structured data.

```python
import re
from decimal import Decimal


def infer_requirement(description: str) -> tuple[str, dict]:
    certification = re.search(
        r"\b(ISO\s*\d{4,5}(?::\d{4})?|EMAS|EN\s*ISO\s*\d{4,5})\b",
        description,
        re.IGNORECASE,
    )
    if certification:
        return "certification", {
            "name": certification.group(1).upper().replace("  ", " "),
        }

    turnover = re.search(
        r"(?:turnover|annual revenue|facturaci[oó]n|volumen de negocios|umsatz)"
        r"[^\d€]{0,80}(?:€|EUR)?\s*([\d.,]+)\s*(million|millones?|mio|m)?",
        description,
        re.IGNORECASE,
    )
    if turnover:
        amount = Decimal(turnover.group(1).replace(",", "."))
        if turnover.group(2):
            amount *= Decimal("1000000")
        return "minimum_annual_turnover", {
            "amount": str(amount),
            "currency": "EUR",
        }

    return "manual_review", {}
```

The real implementation is more defensive about decimal formats and language
variants, but the design principle is the same: extract only what can be
explained and leave the rest as reviewable evidence.

## Profile Matching Before Scoring

Before an opportunity is scored, TenderWise checks whether it satisfies the
company profile's hard discovery rules.

Profiles can contain:

| Profile field                                 | Role                               |
| --------------------------------------------- | ---------------------------------- |
| `country_codes`                               | Target countries                   |
| `excluded_country_codes`                      | Hard geography exclusions          |
| `cpv_codes`                                   | Target CPV families                |
| `excluded_cpv_codes`                          | Hard CPV exclusions                |
| `preferred_min_value` / `preferred_max_value` | Contract-value range               |
| `preferred_currency`                          | Currency used for value comparison |

The matching semantics are intentionally explicit:

- OR within a dimension: any target country can match.
- AND across dimensions: country, CPV, and value rules all need to survive.
- Exclusions override inclusions.
- Unknown values remain visible instead of being silently discarded.
- Non-comparable currencies produce warnings rather than fake precision.

CPV matching deserves special handling because CPV codes are hierarchical.

```python
def normalize_cpv(code: str) -> str:
    digits = "".join(character for character in code if character.isdigit())
    return digits[:8]


def cpv_matches(profile_code: str, notice_code: str) -> bool:
    profile = normalize_cpv(profile_code)
    notice = normalize_cpv(notice_code)

    if not profile or not notice:
        return False

    significant_prefix = profile.rstrip("0") or profile
    return notice.startswith(significant_prefix)
```

A profile code such as `71320000` represents a broader family. A notice using
`71321000` should still be treated as relevant because it belongs under that
family.

The output of discovery matching is not just a boolean. TenderWise also returns
an explanation object with matched countries, matched CPVs, exclusions, value
status, and the reason a contract value could or could not be compared.

## Relevance Is a Strategic Fit Score

Once an opportunity survives the hard discovery gates, TenderWise scores
strategic relevance.

Relevance is not eligibility. It answers:

> Should this opportunity be near the top of the team's feed?

The scoring function evaluates only dimensions configured on the profile. If a
company has not entered target industries, for example, the missing dimension
does not dilute the score.

Mathematically:

$$
\text{relevance} =
\frac{\sum_i w_i s_i}{\sum_i w_i}
$$

where each active dimension has a weight $(w_i)$ and a score $(s_i)$ from 0 to 100.

TenderWise uses dimensions such as:

| Dimension      | Typical weight | Signal                                              |
| -------------- | -------------: | --------------------------------------------------- |
| CPV alignment  |             35 | exact, family, or broad-family CPV match            |
| Geography      |             20 | target country match                                |
| Contract value |             15 | preferred range and currency comparability          |
| Services       |             20 | service terms appearing in title, buyer, or summary |
| Industries     |             10 | industry terms appearing in the notice text         |

The implementation keeps blockers, warnings, and strengths alongside the score:

```python
from dataclasses import dataclass


@dataclass(slots=True)
class RelevanceResult:
    score: float
    breakdown: dict[str, float]
    blockers: list[str]
    warnings: list[str]
    strengths: list[str]
    evidence_sufficient: bool
```

That shape is more useful than returning a number alone. A score of 78 with
"only broad CPV-family alignment" means something different from a score of 78
with an exact CPV match but an unknown contract value.

## Qualification Is a Readiness Score

Qualification answers a different question:

> Can this company satisfy the known mandatory requirements?

TenderWise evaluates each extracted requirement against the selected company
profile.

```python
from dataclasses import dataclass
from decimal import Decimal
from typing import Literal


RequirementStatus = Literal["PASS", "FAIL", "UNKNOWN", "NOT_APPLICABLE"]


@dataclass(slots=True)
class RequirementEvaluation:
    status: RequirementStatus
    reason: str
    evidence: str | None = None


def evaluate_turnover(profile, requirement) -> RequirementEvaluation:
    required = Decimal(str(requirement.structured_value.get("amount", 0)))

    if profile.annual_turnover is None:
        return RequirementEvaluation(
            "UNKNOWN",
            "Annual turnover is missing from the profile",
        )

    if profile.annual_turnover >= required:
        return RequirementEvaluation(
            "PASS",
            "Company turnover meets the threshold",
            f"Profile turnover: {profile.annual_turnover}",
        )

    return RequirementEvaluation(
        "FAIL",
        f"Required annual turnover is {required}",
        f"Profile turnover: {profile.annual_turnover}",
    )
```

Mandatory requirement results map onto score values:

| Evaluation | Score contribution |
| ---------- | -----------------: |
| `PASS`     |                100 |
| `UNKNOWN`  |                 50 |
| `FAIL`     |                  0 |

Unknowns are intentionally not treated as failures. A missing field in a
company profile may mean the company cannot qualify, but it may also mean the
system does not yet have the evidence.

That difference is why TenderWise can recommend `REVIEW` instead of jumping to
`NO_BID`.

## Combining Relevance and Qualification

TenderWise combines the two axes in a deterministic recommendation function.

The final states are:

- `BID`: strong strategic fit and sufficient qualification evidence
- `REVIEW`: promising but incomplete, ambiguous, or below automatic-bid
  thresholds
- `NO_BID`: closed opportunity, hard exclusion, mandatory blocker, low
  relevance, or low qualification readiness

The simplified decision logic looks like this:

```python
def recommend(relevance, qualification, opportunity):
    if opportunity.status == "CLOSED" or opportunity.deadline_has_passed:
        return "NO_BID", "The opportunity is closed or expired"

    if relevance.blockers:
        return "NO_BID", "A configured market or CPV exclusion applies"

    if qualification.blockers:
        return "NO_BID", "At least one mandatory criterion fails"

    if relevance.score < 40:
        return "NO_BID", "Strategic relevance is too low"

    if qualification.score < 45:
        return "NO_BID", "Qualification readiness is too low"

    if qualification.has_unknown_mandatory:
        return "REVIEW", "Mandatory evidence needs manual verification"

    if relevance.score >= 70 and qualification.score >= 80:
        return "BID", "Relevance and qualification jointly support a bid"

    return "REVIEW", "The opportunity should be reviewed before bid effort"
```

This is deliberately less mysterious than a black-box recommendation model.

In procurement, a wrong automatic `BID` can waste days of work. A wrong
automatic `NO_BID` can hide revenue. The rules therefore favor auditable review
whenever important evidence is incomplete.

## Why AI Does Not Override the Recommendation

TenderWise supports optional AI tender briefs, but the AI layer is downstream
of deterministic scoring.

AI can produce:

- an executive summary
- key points
- risks and unknowns
- suggested next steps
- plain-language explanations for extracted requirements

It cannot change the relevance score, qualification score, requirement
evaluation, or recommendation.

The AI input includes the deterministic assessment as structured context:

```python
payload = {
    "tender": {
        "title": opportunity.title,
        "buyer": opportunity.buyer_name,
        "countries": opportunity.country_codes,
        "cpv_codes": opportunity.cpv_codes,
        "deadline": opportunity.deadline.isoformat() if opportunity.deadline else None,
    },
    "company_profile": {
        "services": profile.services,
        "certifications": profile.certifications,
        "annual_turnover": str(profile.annual_turnover)
        if profile.annual_turnover
        else None,
    },
    "deterministic_assessment": {
        "relevance_score": assessment.relevance_score,
        "qualification_score": assessment.qualification_score,
        "recommendation": assessment.recommendation,
        "recommendation_reasons": [
            reason.model_dump()
            for reason in assessment.recommendation_reasons
        ],
    },
}
```

This keeps the generated brief in the right role: explanatory support, not
decision authority.

The AI pipeline also uses a content hash:

```text
prompt version
provider name
model name
tender/profile input
source notice version
profile updated timestamp
    -> SHA-256 input hash
```

If any of those inputs change, cached briefs become stale. That prevents an old
summary from being shown as current after the notice, profile, provider, or
model changes.

## Keeping Long AI Requests Bounded

TED notices can be verbose. Some contain long descriptions and many selection
criteria. TenderWise therefore trims AI input in layers instead of sending the
entire database record to a provider.

The budget strategy is:

1. Start with a structured payload.
2. Trim tender description if the payload is too large.
3. Drop excess requirements while keeping at least one.
4. Shorten requirement descriptions and evidence.
5. Shorten profile text and long list fields.
6. Fail explicitly if the payload still exceeds `AI_MAX_INPUT_CHARS`.

This is not only about provider cost. It also protects latency and keeps
browser requests responsive because generation happens in a Celery worker, not
inside the HTTP request.

```text
Browser clicks "Generate AI brief"
    -> API validates entitlement and queues task
    -> Celery worker builds deterministic context
    -> worker calls Ollama or OpenAI-compatible provider
    -> JSON output is validated with Pydantic
    -> result is cached against the input hash
```

## From Decision to Bid Workspace

A recommendation is useful only if it changes the team's next action.

TenderWise connects each opportunity and company profile to a bid workspace.
The workspace tracks:

- commercial decision state
- workflow stage
- internal deadline
- named bid-team assignments
- task checklist
- requirement-seeded tasks
- comments
- completion progress

The progress calculation is small but important:

```python
from datetime import UTC, datetime


def calculate_progress(items):
    now = datetime.now(UTC)
    total = len(items)
    completed = sum(item.status == "DONE" for item in items)
    blocked = sum(item.status == "BLOCKED" for item in items)
    overdue = sum(
        item.status != "DONE"
        and item.due_at is not None
        and item.due_at < now
        for item in items
    )
    percent = round((completed / total) * 100) if total else 0

    return {
        "total": total,
        "completed": completed,
        "blocked": blocked,
        "overdue": overdue,
        "percent": percent,
    }
```

This is intentionally operational. A procurement team does not only need a
score; it needs a way to assign work and see whether the bid is becoming
submission-ready.

## Background Jobs and Failure Recovery

TenderWise uses Celery for work that should not block user requests:

- TED synchronization
- retrying failed TED notices
- closing or cleaning expired opportunities
- team invitation email
- scheduled digests
- AI tender-brief generation
- worker heartbeat recording

Failed TED notices are persisted with attempt count, error text, status, and
next retry time. Retry delays use bounded exponential backoff:

```python
from datetime import timedelta


def retry_delay(attempt_count: int) -> timedelta:
    hours = min(24, 2 ** max(0, attempt_count - 1))
    return timedelta(hours=hours)
```

This is a simple pattern, but it changes the reliability profile of the system.
A transient XML retrieval problem should become an observable retry state, not a
lost tender.

## Deployment Boundaries

In production, TenderWise sits behind the same shared Nginx and Certbot edge
stack as the rest of my portfolio infrastructure.

```text
Internet
    |
    | https://tenderwise.albertqueralto.dev
    v
Shared Nginx + Certbot edge
    |
    v
tenderwise-web:80
    |-- React static application
    |
    `-- /api/* -> FastAPI
                    |
                    |-- PostgreSQL + pgvector
                    |-- Redis
                    |-- Celery worker
                    |-- Celery Beat
                    |-- backup sidecar
                    `-- optional Ollama container
```

Only the web container joins the public proxy network. PostgreSQL, Redis,
FastAPI, workers, scheduler, backups, and Ollama remain on TenderWise's private
Compose network.

That boundary keeps the deployment boring in the best sense: the public edge
has one job, the application network has another, and stateful services do not
publish host ports.

## Testing the Rules

Rules-based systems still need tests. TenderWise has focused backend tests for:

- TED parsing and storage
- profile matching
- relevance scoring
- qualification evaluation
- AI insight payloads
- bid workspace state
- team permissions
- billing and account behavior
- platform admin operations

The tests matter because deterministic systems can regress quietly. A small
change in CPV normalization, currency handling, or requirement parsing can
change which tenders appear in a feed.

The key test cases are not only happy paths. They include:

- broad CPV family matching
- excluded CPV overrides
- unknown contract values
- currency mismatches
- missing profile evidence
- expired deadlines
- failed mandatory requirements
- unknown mandatory requirements that should produce `REVIEW`

## Lessons Learned

### Separate discovery from scoring

A discovery filter decides what enters the system. A relevance score ranks what
survives. Mixing them makes it harder to explain why an opportunity vanished or
why it is ranked low.

### Keep qualification independent from relevance

A tender can be strategically perfect but impossible to bid because of a hard
requirement. The reverse can also happen: a company may qualify for a tender
that is not worth pursuing.

### Unknown evidence is not the same as failed evidence

Procurement decisions often depend on missing or ambiguous information. Treating
unknowns as `REVIEW` keeps the system useful without pretending to know more
than it does.

### AI belongs after deterministic assessment

Tender text can benefit from summarization, but the recommendation should remain
traceable to source fields, profile settings, and explicit rules.

### Operational features are part of the product

Billing limits, audit logs, notifications, backups, and worker health are not
decorations. They are what make a decision-support tool viable as SaaS instead
of a prototype.

## Final Pipeline

The complete TenderWise pipeline looks like this:

```text
TED Search API
    -> canonical XML retrieval
    -> source-version checksum
    -> lot normalization
    -> requirement parsing
    -> opportunity storage
    -> profile discovery matching
    -> relevance scoring
    -> qualification evaluation
    -> BID / REVIEW / NO_BID recommendation
    -> optional AI brief
    -> bid workspace
    -> notifications, audit logs, billing limits, and worker health
```

The main design choice is restraint.

TenderWise does not try to make procurement decisions magical. It tries to make
them structured, explainable, reviewable, and connected to the actual work of
preparing a bid.
