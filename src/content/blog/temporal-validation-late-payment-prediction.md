---
title: "Temporal Validation for Late-Payment Prediction"
description: "Why late-payment prediction needs more than a chronological train/test split, and how I reconstruct what was actually knowable when each Payrithm prediction would have been made."
date: 2026-09-18
publishAt: 2026-09-18T08:00:00+02:00
tags: ["Machine Learning", "Time Series", "Scikit-learn", "Fintech", "MLOps"]
draft: false
cover: "/og/temporal-validation-late-payment-prediction.png"
featured: false
project: "payrithm"
---

Predicting whether an invoice will be paid late looks like a standard binary-classification problem.

It is not.

The difficult part is not fitting the classifier. The difficult part is making sure the model never learns from information that would only become available after the prediction it is supposed to make.

While building **Payrithm**, this became the most important constraint in the machine-learning pipeline.

The question I use for every feature is:

> Could I have calculated this value at the end of the invoice's issue date?

If the answer is no, it does not belong in the issue-time model.

## Time appears twice in the problem

An invoice dataset contains several different dates:

- issue date,
- due date,
- payment date,
- reminder dates,
- and dispute dates.

It is tempting to think that ordering records by `issue_date` solves temporal leakage.

It does not.

Consider two invoices belonging to the same customer:

```text
Invoice A
issued: January 1
paid: March 15

Invoice B
issued: February 1
```

Invoice A existed when Invoice B was issued.

But its final payment outcome did not.

If I calculate the customer's historical late-payment rate for Invoice B using Invoice A's eventual March payment, I have leaked information from the future.

This creates two separate clocks:

```text
event happened
vs.
outcome became known
```

That distinction is easy to miss.

## Reconstructing historical knowledge

For each new invoice at time \(t\), a previous invoice can contribute to resolved customer-history features only when:

```text
previous issue date < t
AND
previous payment date < t
```

The second condition is the important one.

Conceptually:

```python
known_history = customer_invoices[
    (customer_invoices["issue_date"] < cutoff)
    & customer_invoices["paid_date"].notna()
    & (customer_invoices["paid_date"] < cutoff)
]
```

From those records I can safely calculate features such as:

- number of resolved historical invoices,
- historical late-payment rate,
- mean payment delay,
- maximum payment delay,
- and mean issue-to-payment duration.

This means every invoice gets a historical snapshot appropriate to its own prediction date.

The training table is not simply a dataset of invoices.

It is a dataset of **historical states**.

## Why a full-dataset groupby is dangerous

The convenient approach would be something like:

```python
df.groupby("customer_id")["paid_late"].mean()
```

That produces an apparently sensible customer-risk feature.

It is also wrong for historical prediction.

The calculation can include:

- invoices issued later,
- invoices paid later,
- and potentially the target invoice itself.

The model's evaluation may look excellent because the feature contains a compressed version of the future.

This is why leakage in business datasets is dangerous: it often looks like legitimate feature engineering.

## Cold-start customers must remain in the data

Another complication is customers with no resolved history.

Dropping them makes the modeling problem easier but the application less useful.

A newly acquired customer is exactly the type of situation where payment behavior is uncertain.

Payrithm therefore distinguishes:

```text
customer_late_rate = 0
```

from:

```text
customer_late_rate = unknown because no history exists
```

I use a `history_available` indicator and allow the preprocessing pipeline to impute missing historical aggregates.

The model can still use issue-time information such as:

- amount,
- payment terms,
- currency,
- industry,
- issue month,
- and day of week,

while understanding that customer-history features were unavailable.

## The evaluation set must come from the future

After constructing temporally valid features, the train/test split must preserve the same direction.

Payrithm orders resolved invoices by issue date and uses approximately the latest **20%** as the evaluation period.

Conceptually:

```text
oldest -------------------------------------- newest

|                 training                  | evaluation |
```

The model never trains on an invoice issued after an evaluation invoice.

This answers the question I actually care about:

> If I had trained this model at the end of the historical training period, how would it have performed on the invoices that arrived next?

That is a much more realistic question than asking how well the model performs after randomly shuffling the company's history.

## Preprocessing can leak too

Temporal leakage is not limited to features.

Suppose I calculate median values across the entire dataset and then split it.

The evaluation period has already influenced training preprocessing.

The same problem applies to:

- imputation,
- category mappings,
- scaling,
- feature selection,
- and calibration.

This is one reason I keep preprocessing inside the scikit-learn pipeline.

The pipeline is fitted only on training data.

Evaluation records are transformed using parameters learned from the past.

## Ranking is only half the problem

Payrithm uses a gradient-boosted classifier to estimate:

$$
P(\text{late payment} \mid X)
$$

ROC-AUC tells me whether the model tends to rank late invoices above on-time invoices.

But Payrithm uses the probability itself downstream.

A predicted risk of 80% should mean more than:

> This invoice is high risk.

It should ideally mean that invoices receiving similar probabilities are late roughly 80% of the time.

That makes calibration important.

## Calibration must respect time too

A common calibration workflow uses random cross-validation.

For temporal prediction that can recreate the same problem I tried to remove.

If calibration is necessary, the calibration period should also occur after the model-training period and before the final evaluation period.

Conceptually:

```text
past                                      future
|--------- training --------| calibration | evaluation |
```

Every stage moves forward.

Nothing learns backward.

## Compare against a probability baseline

A machine-learning model should also beat something simpler.

For late-payment probability, an intentionally boring baseline is:

```text
predict the historical training late-payment rate
for every evaluation invoice
```

I evaluate probability quality using the Brier score:

$$
\frac{1}{N}\sum_{i=1}^{N}(p_i-y_i)^2
$$

and compare it with that baseline.

If the model cannot beat the historical base-rate predictor on future invoices, deploying it simply because training succeeded would not make sense.

## Temporal validity continues after deployment

A chronological holdout is not the end of the problem.

Payment behavior changes. Customer composition changes. Payment terms change. Economic conditions change. The fraction of cold-start customers can change.

For each training run, I want to preserve information such as:

- training-period boundaries,
- evaluation-period boundaries,
- late-payment prevalence,
- ROC-AUC,
- Brier score,
- baseline Brier score,
- feature version,
- and model version.

That gives future training runs something meaningful to compare against.

## The broader lesson

The most dangerous form of leakage is not an obviously illegal column called `target`.

It is a feature that seems reasonable but quietly contains knowledge from the future.

Temporal models therefore need a stronger definition of correctness:

> A training row should reproduce the information state that would have existed at the real prediction timestamp.

Once I started treating historical state reconstruction as part of the model—not just data preparation—the rest of the Payrithm pipeline became much easier to reason about.

The objective is not to create the most impressive offline metric.

It is to build an evaluation that I am willing to trust when the next invoice arrives.
