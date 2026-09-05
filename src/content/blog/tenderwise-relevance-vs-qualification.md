---
title: "Why TenderWise Separates Relevance from Qualification"
description: "Why TenderWise evaluates strategic relevance and mandatory qualification separately instead of collapsing procurement decisions into one opaque tender-match score."
date: 2026-11-24
publishAt: 2026-11-24T08:00:00+02:00
tags: ["Decision Systems", "Procurement", "SaaS", "Explainability", "Product Engineering"]
draft: false
cover: "/og/tenderwise-relevance-vs-qualification.png"
featured: false
project: "tenderwise"
---

A tender can be an excellent commercial opportunity and still be impossible for a company to bid.

The reverse is also true.

A company can satisfy every formal requirement for a tender that it has no strategic reason to pursue.

That sounds obvious.

It also means a single "tender match score" is conceptually wrong.

This is why **TenderWise** keeps **relevance** and **qualification** as separate decision axes.

## Procurement contains several different questions

When a procurement team opens a tender, it may ask:

```text
Is this in one of our target markets?
Does the CPV scope match our services?
Is the contract large enough to justify the effort?
Do we satisfy turnover requirements?
Do we have the required certifications?
Do we have enough comparable experience?
```

Some of those questions describe attractiveness.

Others describe eligibility.

Collapsing them too early destroys useful information.

TenderWise therefore separates four stages:

```text
discovery
    |
    v
relevance
    |
    v
qualification
    |
    v
bid execution
```

Each has a different job.

## Discovery decides whether the opportunity belongs in the feed

Before scoring, a company profile can define hard filters such as:

- target countries,
- excluded countries,
- target CPV families,
- excluded CPVs,
- preferred contract values,
- and preferred currency.

The matching semantics are intentionally explicit.

Within a dimension, alternatives can match.

Across dimensions, configured requirements need to survive.

Exclusions override inclusions.

The goal is not to assign a nuanced score yet.

It is to answer:

> Should this opportunity enter the decision process?

## Relevance asks whether the opportunity is strategically attractive

Once an opportunity survives discovery, TenderWise calculates a relevance score.

Dimensions can include:

- CPV alignment,
- geography,
- contract value,
- service alignment,
- and industry alignment.

Typical weights in the current design are:

```text
CPV               35
geography         20
contract value    15
services          20
industries        10
```

Only configured dimensions participate.

That is important.

If a company has never configured target industries, the absence should not artificially reduce every tender's relevance score.

Conceptually:

$$
Relevance =
\frac{\sum w_i s_i}{\sum w_i}
$$

where the denominator contains only active dimensions.

The output also retains:

- strengths,
- warnings,
- blockers,
- score breakdown,
- and evidence sufficiency.

A number without that context is not enough.

## Qualification asks a different question

Qualification starts from mandatory tender requirements.

Examples include:

- minimum annual turnover,
- certifications,
- minimum team size,
- and comparable contract experience.

Each requirement can produce a state such as:

```text
PASS
FAIL
UNKNOWN
NOT_APPLICABLE
```

The most important state is often `UNKNOWN`.

Suppose a tender requires ISO 9001.

The company profile does not list ISO 9001.

That could mean:

```text
the company does not have it
```

or:

```text
the profile is incomplete
```

Those are not equivalent.

TenderWise therefore refuses to silently convert missing evidence into failure.

## Why UNKNOWN matters

For mandatory requirements, a simplified scoring mapping is:

```text
PASS       -> 100
UNKNOWN    -> 50
FAIL       -> 0
```

The exact numeric contribution is less important than the semantic distinction.

An unknown mandatory criterion often means:

```text
REVIEW
```

not:

```text
NO_BID
```

That prevents the software from claiming certainty that the evidence does not support.

## Consider four tenders

The separation becomes clearer in a matrix.

### Tender A

```text
Relevance:      92
Qualification:  95
```

The opportunity fits the company's market and the known mandatory criteria are satisfied.

A `BID` recommendation is plausible.

### Tender B

```text
Relevance:      91
Qualification:  20
```

Commercially excellent.

But a mandatory requirement fails.

This should not become a high combined score simply because relevance is strong.

The likely answer is `NO_BID`.

### Tender C

```text
Relevance:      45
Qualification:  98
```

The company is capable of performing the work.

It is simply not especially attractive.

That is a different reason not to bid.

### Tender D

```text
Relevance:      82
Qualification:  65
Mandatory evidence: UNKNOWN
```

This is exactly where `REVIEW` is valuable.

The system has enough evidence to say the tender looks promising, but not enough to make the decision automatically.

## The recommendation remains deterministic

TenderWise eventually combines both axes into a recommendation.

A simplified version contains rules such as:

```text
closed deadline              -> NO_BID
hard relevance blocker       -> NO_BID
mandatory qualification fail -> NO_BID
very low relevance           -> NO_BID
very low qualification       -> NO_BID
unknown mandatory evidence   -> REVIEW
high relevance + readiness   -> BID
otherwise                    -> REVIEW
```

This is intentionally understandable.

Procurement decisions can consume days of expensive human effort.

A wrong automatic `BID` wastes resources.

A wrong automatic `NO_BID` can hide revenue.

When uncertainty remains material, review is a feature rather than a failure.

## Why I do not let AI make the decision

TenderWise can optionally generate an AI tender brief.

The brief can explain:

- summary,
- key points,
- risks,
- unknowns,
- next steps,
- and qualification requirements.

But it cannot modify:

```text
relevance
qualification
requirement status
BID / REVIEW / NO_BID
```

The AI layer receives the deterministic result as context.

It explains the decision environment.

It does not become the decision authority.

That boundary is particularly important in procurement because source evidence needs to remain traceable.

## Separation improves debugging

Suppose a user says:

> This tender should have ranked higher.

With one opaque score I need to reverse-engineer what happened.

With separate layers I can ask:

```text
Was it filtered during discovery?
Was CPV relevance low?
Was contract value unknown?
Did a mandatory requirement fail?
Was evidence missing?
```

Each layer has an interpretable responsibility.

That makes bugs easier to locate and recommendations easier to discuss with users.

## Separation also improves product iteration

Imagine users tell me that geography should matter less and service alignment more.

That changes relevance.

It does not change how annual-turnover requirements should be evaluated.

Likewise, improving certification parsing should affect qualification without changing strategic market preferences.

Independent concepts can evolve independently.

That is a powerful property in a product that is still learning from real users.

## The broader design principle

The relevance/qualification split is not specific to TenderWise.

It represents a general decision-system rule:

> Separate "Do I want this?" from "Can I do this?"

Recruitment systems might separate candidate interest from eligibility.

Credit systems might separate customer value from underwriting constraints.

Project-selection systems might separate strategic value from execution feasibility.

Different questions deserve different state.

TenderWise becomes easier to explain precisely because it does not force everything into a single magic number.

The final recommendation is useful because the reasoning underneath it remains visible.
