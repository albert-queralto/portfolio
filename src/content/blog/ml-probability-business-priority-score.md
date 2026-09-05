---
title: "From ML Probability to Business Priority Score"
description: "Why Payrithm does not simply sort invoices by late-payment probability, and how I combine calibrated ML risk with value, urgency and collection activity."
date: 2026-10-28
publishAt: 2026-10-28T08:00:00+02:00
tags: ["Machine Learning", "Product Engineering", "Fintech", "Decision Systems", "Explainability"]
draft: false
cover: "/og/ml-probability-business-priority-score.png"
featured: false
project: "payrithm"
---

A machine-learning model can answer an important question and still fail to tell a user what to do.

**Payrithm** estimates the probability that an invoice will be paid late.

Suppose the model returns:

```text
Invoice A: 90% late-payment risk
Invoice B: 65% late-payment risk
```

If Payrithm were only a prediction dashboard, sorting by probability would be enough.

But the actual product question is:

> Which invoice should the collections team work on first?

Those are not equivalent problems.

## Probability measures risk, not importance

Consider:

| Invoice | Late probability | Amount | Status |
| --- | ---: | ---: | --- |
| A | 90% | €150 | Due in 25 days |
| B | 65% | €48,000 | Overdue |

Invoice A has the higher predicted risk.

Invoice B may have the higher operational priority.

A finance team does not allocate attention based only on probability.

The value at risk and time sensitivity matter too.

This is why Payrithm keeps two concepts separate:

```text
ML prediction
      |
      v
probability of late payment


business policy
      |
      v
collection priority
```

The second consumes the first.

It does not replace it.

## The current priority model

The explainable priority score combines four normalized signals:

\[
Priority =
0.45P(\text{late}) +
0.25A +
0.25U +
0.05R
\]

where:

- \(P\) = predicted late-payment probability,
- \(A\) = relative invoice amount,
- \(U\) = due-date urgency,
- \(R\) = reminder pressure.

The weights currently express a product policy:

```text
45% risk
25% value
25% urgency
5% reminder activity
```

The exact weights can evolve.

What matters architecturally is that they remain visible.

## Why probability receives the largest weight

The late-payment classifier estimates whether the invoice is likely to require attention.

That deserves substantial influence.

But giving it 100% of the ranking would imply:

> The collections team only cares about probability.

That is not how financial operations work.

A highly risky €100 invoice and a moderately risky €50,000 invoice create different decisions.

The machine-learning score therefore remains an important input without being mistaken for the complete business objective.

## Comparing invoice values across currencies

Raw amount introduces another problem.

These values are not directly comparable:

```text
10,000 EUR
10,000 USD
10,000 GBP
```

Payrithm avoids pretending they are identical.

Without a trusted exchange-rate policy, the priority calculation uses the invoice's **amount percentile within its own currency**.

For example:

```python
amount_percentile = (
    invoices
    .groupby("currency")["amount"]
    .rank(pct=True)
)
```

The question becomes:

> How large is this invoice compared with other invoices denominated in the same currency?

That produces a normalized signal between zero and one without inventing an exchange rate.

## Urgency changes every day

Late-payment probability is generated from issue-time information.

Urgency is operational.

An invoice that was issued three weeks ago may now be approaching its due date.

Another may already be overdue.

Payrithm therefore calculates due-date urgency separately from the model.

A simplified function is:

```python
days_to_due = (due_date - today).days

urgency = min(
    1.0,
    max(0.0, (30 - days_to_due) / 30),
)
```

An invoice far from its due date receives low urgency.

As the deadline approaches, urgency increases.

Once overdue, the signal remains high.

This signal should not be injected into the issue-time classifier because it did not exist at prediction time.

It belongs in the operational layer.

## Reminder pressure belongs there too

The same argument applies to reminders.

How many reminders have been sent is useful when deciding what to do today.

It is not valid information for predicting risk on the day an invoice was issued.

Payrithm can normalize current reminder activity, for example:

```python
reminder_pressure = min(
    1.0,
    reminders_sent / 3,
)
```

and incorporate it into the priority score.

The model and workflow therefore operate at different timestamps.

## Why I did not begin with a second black-box ranking model

It would be possible to train another model to produce a collection-priority score.

I deliberately did not make that the first design.

An operational queue needs to answer:

> Why is this invoice above that one?

With the current formula, the answer is visible:

```text
high predicted risk
+
large invoice relative to its currency
+
already overdue
+
several previous reminders
```

The user does not need a complex explanation system to understand the queue ordering.

That simplicity has value.

## Policy can change without retraining the model

The separation also makes the system adaptable.

Imagine a company entering a temporary cash-flow constraint.

It might care more about invoice value.

The priority policy could shift from:

```text
risk:       45%
amount:     25%
urgency:    25%
reminders:   5%
```

toward a stronger amount component.

The late-payment classifier does not need to be retrained.

Nothing about customer payment behavior changed.

Only the business's current decision policy changed.

This is a useful distinction:

> Models describe the world. Decision rules describe what we want to do about it.

They should not automatically be the same artifact.

## Calibration becomes more important when probability enters a formula

Payrithm evaluates probability quality with ROC-AUC, calibration analysis and the Brier score.

Calibration matters here because the probability is not merely being sorted.

It receives a numerical weight in a downstream decision.

If a model outputs 0.90 for events that occur only 60% of the time, the priority formula overweights risk.

That is why I care about both:

```text
ranking quality
and
probability quality
```

A highly discriminative but badly calibrated model may still distort downstream decisions.

## Explainability exists at two levels

There are really two explanations in the system.

The first is:

> Why did the model predict a high probability?

That can be investigated through model diagnostics and feature interpretation.

The second is:

> Why is this invoice at the top of the collection queue?

That explanation is much simpler.

The priority components themselves answer it.

A user might see:

```text
Late-payment risk      0.82
Relative amount        0.91
Due-date urgency       1.00
Reminder pressure      0.67
--------------------------------
Priority score         ...
```

The business decision remains inspectable.

## Prediction is not decision-making

This pattern extends beyond accounts receivable.

A fraud model can estimate fraud probability without determining the entire investigation queue.

A maintenance model can estimate failure risk without deciding when equipment should be shut down.

The architectural lesson I took into Payrithm is therefore broader:

> An ML output should often be an input into an explicit decision system, not the final decision itself.

The classifier's job is to estimate payment risk as accurately and honestly as possible.

The priority layer's job is to translate that risk into today's operational context.

Keeping those responsibilities separate makes both easier to evaluate, change and explain.
