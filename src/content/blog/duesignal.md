---

title: "Building an Invoice Late-Payment Predictor with Python and Scikit-learn"
description: "How I designed DueSignal’s machine-learning pipeline to predict late invoice payments without data leakage, evaluate probability quality, and turn model outputs into actionable collection priorities."
date: 2026-07-25
tags: ["Machine Learning", "Scikit-learn", "Python", "Fintech", "MLOps"]
draft: false
------------

Predicting whether an invoice will be paid late sounds like a straightforward binary-classification problem:

* `0`: the invoice is paid on time
* `1`: the invoice is paid late

The difficult part is not training a classifier. The difficult part is building a prediction system that reflects what would actually be known when a new invoice is created.

A model can appear highly accurate while accidentally using payment information from the future. It can rank invoices by risk without producing trustworthy probabilities. It can also generate technically correct predictions that never translate into useful collection decisions.

These were the problems I wanted to solve while building **DueSignal**, an accounts-receivable intelligence application that predicts late payments, estimates payment timing, prioritizes collections, and forecasts incoming cash.

In this article, I will walk through the complete modeling journey:

1. Defining the business problem
2. Preparing invoice data
3. Preventing temporal data leakage
4. Engineering customer-history features
5. Creating a chronological train/test split
6. Evaluating ranking and probability quality
7. Turning predictions into collection priorities

The examples use Python, pandas, and scikit-learn. The same principles apply to many real-world prediction systems involving customers, transactions, and time-dependent behavior.

## The Business Problem

Accounts-receivable teams rarely have enough time to treat every unpaid invoice equally.

A company might have hundreds or thousands of outstanding invoices. Some will be paid without intervention. Others require reminders, calls, dispute resolution, or escalation.

The operational question is therefore not simply:

> Which invoices are unpaid?

The more useful questions are:

* Which newly issued invoices are likely to be paid late?
* How long after the due date might payment arrive?
* Which outstanding invoices deserve attention first?
* How much cash is likely to arrive during the next few weeks?

DueSignal approaches the problem with two related machine-learning models:

* A **classifier** that estimates the probability of late payment
* A **regressor** that estimates payment delay relative to the due date

This article focuses primarily on the classifier.

For an invoice (i), the classifier estimates:

$$
P(Y_i = 1 \mid X_i)
$$

where:

* $(Y_i = 1)$ means the invoice is eventually paid after its due date
* $(X_i)$ contains information available when the invoice is issued

That final condition is essential.

The model is intended to make an **issue-time prediction**. It should behave as though it is operating on the day the invoice is created—not several weeks later, after reminders, disputes, overdue days, and payment outcomes are already known.

## Defining the Prediction Target

For resolved invoices, the late-payment label can be derived by comparing the payment date with the due date:

$$
\text{paid_late} =
\begin{cases}
1 & \text{if paid_date} > \text{due_date} \
0 & \text{otherwise}
\end{cases}
$$

The payment-delay target used by the companion regression model is:

$$
\text{delay_days} =
\text{paid_date} - \text{due_date}
$$

A negative value means the invoice was paid early. A value of zero means it was paid on its due date. A positive value represents the number of days late.

Unresolved invoices do not yet have a final outcome, so they cannot be used as supervised training examples. They can still be scored after the model has been trained.

## Preparing the Invoice Data

DueSignal imports invoice data from CSV files.

The minimum required fields are:

| Field         | Description                  |
| ------------- | ---------------------------- |
| `invoice_id`  | Unique invoice identifier    |
| `customer_id` | Identifier for the customer  |
| `issue_date`  | Date the invoice was issued  |
| `due_date`    | Contractual payment deadline |
| `amount`      | Invoice value                |

The system can also use optional fields such as:

* `paid_date`
* `currency`
* `customer_industry`
* `disputed`
* `dispute_opened_date`
* `reminders_sent`
* `last_reminder_date`

The first preparation step is validating types, dates, identifiers, and basic business rules.

```python
from __future__ import annotations

import numpy as np
import pandas as pd


REQUIRED_COLUMNS = {
    "invoice_id",
    "customer_id",
    "issue_date",
    "due_date",
    "amount",
}

DATE_COLUMNS = [
    "issue_date",
    "due_date",
    "paid_date",
    "dispute_opened_date",
    "last_reminder_date",
]


def prepare_invoices(raw: pd.DataFrame) -> pd.DataFrame:
    missing = REQUIRED_COLUMNS.difference(raw.columns)

    if missing:
        raise ValueError(
            f"Missing required invoice columns: {sorted(missing)}"
        )

    invoices = raw.copy()

    for column in DATE_COLUMNS:
        if column in invoices.columns:
            invoices[column] = pd.to_datetime(
                invoices[column],
                errors="coerce",
                utc=True,
            ).dt.tz_localize(None)

    invoices["amount"] = pd.to_numeric(
        invoices["amount"],
        errors="coerce",
    )

    invoices = invoices.dropna(
        subset=[
            "invoice_id",
            "customer_id",
            "issue_date",
            "due_date",
            "amount",
        ]
    )

    invoices = invoices[invoices["amount"] > 0]
    invoices = invoices[
        invoices["due_date"] >= invoices["issue_date"]
    ]

    if invoices["invoice_id"].duplicated().any():
        duplicates = invoices.loc[
            invoices["invoice_id"].duplicated(),
            "invoice_id",
        ].tolist()

        raise ValueError(
            f"Duplicate invoice identifiers found: {duplicates[:5]}"
        )

    invoices["payment_terms_days"] = (
        invoices["due_date"] - invoices["issue_date"]
    ).dt.days

    invoices["delay_days"] = np.nan
    invoices["paid_late"] = pd.Series(
        pd.NA,
        index=invoices.index,
        dtype="boolean",
    )

    resolved = invoices["paid_date"].notna()

    invoices.loc[resolved, "delay_days"] = (
        invoices.loc[resolved, "paid_date"]
        - invoices.loc[resolved, "due_date"]
    ).dt.days

    invoices.loc[resolved, "paid_late"] = (
        invoices.loc[resolved, "paid_date"]
        > invoices.loc[resolved, "due_date"]
    )

    return invoices.sort_values(
        ["issue_date", "invoice_id"]
    ).reset_index(drop=True)
```

Production validation requires more than checking for missing values.

For example, I also want to detect:

* Payment dates before issue dates
* Unexpectedly large or negative payment terms
* Unknown currencies
* Duplicate invoice identifiers
* Sudden schema changes
* Amounts that are malformed or incorrectly scaled
* Categorical values with inconsistent spelling

These checks prevent data-quality errors from silently becoming model behavior.

## Never Combine Amounts Across Currencies

An invoice for `10,000 USD` should not be directly compared with one for `10,000 EUR`, `10,000 GBP`, or `10,000 MXN`.

DueSignal therefore avoids aggregating or ranking raw invoice amounts across currencies.

For collection prioritization, invoice value is converted into a percentile within its own currency:

```python
invoices["amount_percentile"] = (
    invoices.groupby("currency")["amount"]
    .rank(method="average", pct=True)
)
```

This does not perform currency conversion, but it provides a useful relative signal:

> How large is this invoice compared with other invoices in the same currency?

A production system could also convert values using a trusted exchange-rate source, but that introduces additional questions about rate dates, accounting policy, and reproducibility.

## The Most Dangerous Problem: Data Leakage

Data leakage happens when model training uses information that would not have been available at prediction time.

In invoice prediction, leakage is especially easy to introduce because the dataset is usually extracted after many invoices have already been paid.

Consider a model trained with these columns:

* `paid_date`
* `days_overdue`
* `reminders_sent`
* `last_reminder_date`
* `disputed`
* Customer late-payment percentage calculated using all invoices

The resulting metrics might look excellent. The model may have indirectly received the answer.

### Information that must not enter an issue-time model

| Field or feature                 | Why it leaks                                   |
| -------------------------------- | ---------------------------------------------- |
| `paid_date`                      | It directly reveals the final outcome          |
| `delay_days`                     | It is derived from the target                  |
| `paid_late`                      | It is the classification target                |
| Current overdue days             | A new invoice is not overdue when issued       |
| Future reminders                 | They happen after the prediction date          |
| Final dispute status             | The dispute may have opened after issue        |
| Lifetime customer late rate      | It may include invoices resolved in the future |
| Preprocessing fitted on all data | It exposes evaluation-set statistics           |

The guiding question for every candidate feature is:

> Could I have calculated this value at the end of the invoice’s issue date?

If the answer is no, the feature does not belong in the issue-time prediction model.

## Prediction Features and Operational Features Are Different

DueSignal separates two concepts that are often incorrectly mixed together.

### Issue-time prediction features

These are used by the machine-learning model:

* Invoice amount
* Currency
* Payment terms
* Issue month
* Issue day of week
* Customer industry
* Customer behavior known before the invoice was issued
* Whether sufficient customer history exists

### Live operational features

These can be used later when ranking currently open invoices:

* Days until the due date
* Whether the invoice is already overdue
* Number of reminders sent
* Time since the latest reminder
* Current dispute state
* Current invoice status

Live operational signals are useful for collection decisions, but they cannot be presented to the model as though they were known at issue time.

Keeping prediction and prioritization separate makes the system easier to reason about and evaluate.

## Engineering Customer-History Features

A customer’s previous payment behavior is one of the most useful sources of predictive information.

Potential historical features include:

* Number of previously resolved invoices
* Historical late-payment rate
* Average delay relative to the due date
* Maximum historical delay
* Average number of days between issue and payment
* Whether the customer has any usable history

The naïve implementation is:

```python
invoices.groupby("customer_id")["paid_late"].mean()
```

That calculation is unsafe.

It uses the customer’s entire history, including invoices issued and paid after the invoice currently being modeled.

Instead, each invoice needs a historical snapshot reconstructed as of its issue date.

For an invoice issued at time (t), an earlier invoice is eligible for resolved-history features only when:

1. It belongs to the same customer
2. It was issued before (t)
3. Its payment outcome was known before (t)

The third condition matters. An earlier invoice might exist at time (t), but if it was still unpaid, its eventual outcome was not yet known.

The following implementation prioritizes clarity over maximum performance:

```python
def add_customer_history_features(
    invoices: pd.DataFrame,
) -> pd.DataFrame:
    feature_rows: list[dict[str, float | int]] = []

    for _, customer_invoices in invoices.groupby(
        "customer_id",
        sort=False,
    ):
        customer_invoices = customer_invoices.sort_values(
            ["issue_date", "invoice_id"]
        )

        for index, current in customer_invoices.iterrows():
            cutoff = current["issue_date"]

            known_resolved = customer_invoices[
                (customer_invoices["issue_date"] < cutoff)
                & customer_invoices["paid_date"].notna()
                & (customer_invoices["paid_date"] < cutoff)
            ]

            history_count = len(known_resolved)

            if history_count == 0:
                feature_rows.append(
                    {
                        "index": index,
                        "history_available": 0,
                        "customer_resolved_count": 0,
                        "customer_late_rate": np.nan,
                        "customer_mean_delay_days": np.nan,
                        "customer_max_delay_days": np.nan,
                        "customer_mean_days_to_pay": np.nan,
                    }
                )
                continue

            days_to_pay = (
                known_resolved["paid_date"]
                - known_resolved["issue_date"]
            ).dt.days

            feature_rows.append(
                {
                    "index": index,
                    "history_available": 1,
                    "customer_resolved_count": history_count,
                    "customer_late_rate": (
                        known_resolved["paid_late"]
                        .astype(float)
                        .mean()
                    ),
                    "customer_mean_delay_days": (
                        known_resolved["delay_days"].mean()
                    ),
                    "customer_max_delay_days": (
                        known_resolved["delay_days"].max()
                    ),
                    "customer_mean_days_to_pay": (
                        days_to_pay.mean()
                    ),
                }
            )

    history = (
        pd.DataFrame(feature_rows)
        .set_index("index")
        .sort_index()
    )

    return invoices.join(history)
```

This implementation performs repeated filtering and will become slow on a very large dataset. In production, the same logic can be implemented more efficiently using chronological event processing, expanding aggregates, or database window operations.

The important part is the temporal rule—not the exact implementation.

## Handling New Customers

A new customer may have no resolved invoice history.

This is a classic cold-start problem.

Removing these invoices would make the model less useful because new customers are often exactly where risk is most uncertain. Instead, DueSignal includes a `history_available` indicator and lets the preprocessing pipeline impute missing historical values.

For a new customer, the model can still use:

* Invoice amount
* Payment terms
* Currency
* Industry
* Calendar features
* Overall patterns learned from other customers

The history indicator allows the model to distinguish between:

* A real historical late rate of zero
* A missing late rate because no history exists

Those situations should not be treated as equivalent.

## Additional Issue-Time Features

Calendar and contractual features can be derived safely from the issue and due dates:

```python
def add_issue_time_features(
    invoices: pd.DataFrame,
) -> pd.DataFrame:
    featured = invoices.copy()

    featured["issue_month"] = (
        featured["issue_date"].dt.month
    )

    featured["issue_day_of_week"] = (
        featured["issue_date"].dt.dayofweek
    )

    featured["issue_quarter"] = (
        featured["issue_date"].dt.quarter
    )

    featured["is_month_end"] = (
        featured["issue_date"].dt.is_month_end.astype(int)
    )

    featured["log_amount"] = np.log1p(
        featured["amount"]
    )

    return featured
```

I prefer using a log-transformed amount because invoice values are commonly right-skewed. A small number of large invoices can otherwise dominate the numerical scale.

I do not include the raw `customer_id` as a categorical feature. Doing so encourages the model to memorize specific customers and creates problems when unseen customers arrive.

Historical behavior aggregates are generally more transferable.

## Building the Scikit-learn Pipeline

DueSignal uses a `GradientBoostingClassifier` for late-payment probability.

Gradient-boosted decision trees are a strong baseline for structured business data because they can model:

* Non-linear relationships
* Interactions between variables
* Threshold effects
* Mixed numerical and categorical inputs after preprocessing

The preprocessing and classifier are wrapped in one scikit-learn pipeline.

```python
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder


NUMERIC_FEATURES = [
    "log_amount",
    "payment_terms_days",
    "issue_month",
    "issue_day_of_week",
    "issue_quarter",
    "is_month_end",
    "history_available",
    "customer_resolved_count",
    "customer_late_rate",
    "customer_mean_delay_days",
    "customer_max_delay_days",
    "customer_mean_days_to_pay",
]

CATEGORICAL_FEATURES = [
    "currency",
    "customer_industry",
]


numeric_pipeline = Pipeline(
    steps=[
        (
            "imputer",
            SimpleImputer(strategy="median"),
        ),
    ]
)

categorical_pipeline = Pipeline(
    steps=[
        (
            "imputer",
            SimpleImputer(strategy="most_frequent"),
        ),
        (
            "encoder",
            OneHotEncoder(
                handle_unknown="ignore",
                sparse_output=False,
            ),
        ),
    ]
)

preprocessor = ColumnTransformer(
    transformers=[
        (
            "numeric",
            numeric_pipeline,
            NUMERIC_FEATURES,
        ),
        (
            "categorical",
            categorical_pipeline,
            CATEGORICAL_FEATURES,
        ),
    ]
)

late_payment_model = Pipeline(
    steps=[
        ("preprocessor", preprocessor),
        (
            "classifier",
            GradientBoostingClassifier(
                random_state=42,
            ),
        ),
    ]
)
```

Placing preprocessing inside the pipeline is not just a convenience.

It ensures that:

* Imputation values are learned from the training set
* Category mappings are learned from the training set
* Evaluation data is transformed using training-set rules
* The same preprocessing is applied during inference
* The model and its feature transformations can be versioned together

Fitting transformations before splitting the data would be another form of leakage.

## Why a Random Train/Test Split Is Misleading

A standard machine-learning tutorial might use:

```python
from sklearn.model_selection import train_test_split

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42,
)
```

That is inappropriate for this problem.

A random split mixes old and recent invoices. The model can train on future business patterns and then be evaluated on older invoices.

Real deployment works in the opposite direction:

1. Train on historical invoices
2. Predict invoices that arrive later

The evaluation should reproduce that direction.

DueSignal uses the latest approximately 20% of resolved invoices as the evaluation period.

```python
def chronological_split(
    resolved_invoices: pd.DataFrame,
    test_fraction: float = 0.20,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    ordered = resolved_invoices.sort_values(
        ["issue_date", "invoice_id"]
    ).reset_index(drop=True)

    tentative_index = int(
        len(ordered) * (1 - test_fraction)
    )

    cutoff_date = ordered.loc[
        tentative_index,
        "issue_date",
    ]

    train = ordered[
        ordered["issue_date"] < cutoff_date
    ].copy()

    test = ordered[
        ordered["issue_date"] >= cutoff_date
    ].copy()

    if train.empty or test.empty:
        raise ValueError(
            "Not enough chronological data to create "
            "both training and evaluation sets."
        )

    return train, test
```

Using the issue date as the split axis answers a realistic question:

> If the model had been trained at the end of the training period, how well would it have predicted invoices issued afterward?

A chronological evaluation is often harder than a random evaluation. That is expected.

The objective is not to produce the most impressive metric. It is to estimate future performance honestly.

## Training the Classifier

After generating issue-time features and selecting resolved invoices, training becomes straightforward:

```python
prepared = prepare_invoices(raw_invoices)
prepared = add_customer_history_features(prepared)
prepared = add_issue_time_features(prepared)

resolved = prepared[
    prepared["paid_late"].notna()
].copy()

train, test = chronological_split(resolved)

feature_columns = (
    NUMERIC_FEATURES
    + CATEGORICAL_FEATURES
)

X_train = train[feature_columns]
y_train = train["paid_late"].astype(int)

X_test = test[feature_columns]
y_test = test["paid_late"].astype(int)

late_payment_model.fit(X_train, y_train)

late_probabilities = late_payment_model.predict_proba(
    X_test
)[:, 1]
```

The output is a probability between zero and one.

An invoice with a predicted probability of `0.82` is considered riskier than one with a probability of `0.18`.

But a useful risk model needs more than correct ordering.

Its probabilities should also mean something.

## Why Accuracy Is Not Enough

Suppose 80% of invoices are paid on time.

A model that predicts “on time” for every invoice achieves 80% accuracy while providing no useful risk discrimination.

Accuracy also depends on selecting a classification threshold. Different collection teams may choose different thresholds depending on:

* Available staff
* Invoice value
* Customer relationships
* Cost of unnecessary intervention
* Cost of missed late payments

DueSignal therefore evaluates the probability output directly rather than relying only on thresholded classifications.

The main classifier metrics are:

* ROC-AUC
* Brier score
* Baseline Brier score
* Calibration behavior

## ROC-AUC: Can the Model Rank Risk?

ROC-AUC measures how well the model separates late invoices from on-time invoices across all possible thresholds.

An intuitive interpretation is:

> If I randomly select one late invoice and one on-time invoice, how often does the model assign the late invoice a higher risk score?

A value near:

* `0.50` indicates random ranking
* `1.00` indicates perfect ranking

```python
from sklearn.metrics import roc_auc_score

roc_auc = roc_auc_score(
    y_test,
    late_probabilities,
)
```

ROC-AUC is valuable because collection teams usually begin with a ranking problem. They want the highest-risk invoices near the top of the queue.

However, ROC-AUC does not tell us whether the probability values are trustworthy.

A model could rank invoices correctly while assigning probabilities that are consistently too high or too low.

## Probability Calibration

A calibrated model produces probabilities that correspond to observed frequencies.

Among invoices assigned a risk near 20%, approximately 20% should eventually be paid late.

Among invoices assigned a risk near 80%, approximately 80% should eventually be paid late.

Calibration matters because DueSignal uses probabilities in downstream decisions. A score of `0.80` should represent more than “high risk.” It should approximate an 80% event likelihood.

A calibration table can be generated with scikit-learn:

```python
from sklearn.calibration import calibration_curve

observed_rate, predicted_rate = calibration_curve(
    y_test,
    late_probabilities,
    n_bins=10,
    strategy="quantile",
)

calibration_table = pd.DataFrame(
    {
        "mean_predicted_probability": predicted_rate,
        "observed_late_rate": observed_rate,
    }
)

print(calibration_table)
```

For a perfectly calibrated model, the predicted and observed columns would be equal.

In practice, I inspect whether the model:

* Underestimates risk for high-risk invoices
* Overestimates risk for low-risk invoices
* Produces probabilities concentrated in a narrow range
* Has unstable calibration in periods with little data

When calibration needs improvement, it should be performed using a chronological calibration period—not randomly mixed folds that break the temporal structure.

## Brier Score: Measuring Probability Quality

The Brier score measures the mean squared difference between predicted probabilities and actual outcomes:

$$
\text{Brier Score}
==================

\frac{1}{N}
\sum_{i=1}^{N}
(p_i-y_i)^2
$$

where:

* $(p_i)$ is the predicted late-payment probability
* $(y_i)$ is the actual binary result

Lower values are better.

```python
from sklearn.metrics import brier_score_loss

brier = brier_score_loss(
    y_test,
    late_probabilities,
)
```

The Brier score penalizes confident mistakes heavily.

Consider two late invoices:

| Actual result | Prediction | Squared error |
| ------------- | ---------: | ------------: |
| Late          |       0.90 |          0.01 |
| Late          |       0.10 |          0.81 |

The second prediction is not merely ranked incorrectly. It is confidently wrong.

This makes the Brier score particularly useful for systems where probabilities influence financial decisions.

## Always Compare Against a Baseline

A metric has little meaning without a reference point.

The simplest probability baseline predicts the training-set late-payment rate for every evaluation invoice.

```python
import numpy as np

training_late_rate = y_train.mean()

baseline_probabilities = np.full(
    shape=len(y_test),
    fill_value=training_late_rate,
    dtype=float,
)

baseline_brier = brier_score_loss(
    y_test,
    baseline_probabilities,
)
```

The classifier should achieve a lower Brier score than this baseline on the chronological evaluation set.

DueSignal records metrics such as:

```python
training_metrics = {
    "classifier_roc_auc": roc_auc,
    "classifier_brier": brier,
    "classifier_baseline_brier": baseline_brier,
}
```

A model is not promoted simply because training completed successfully. It must demonstrate value over a chronological baseline.

That deployment gate prevents a newly trained but weaker model from automatically replacing the current one.

## The Companion Payment-Delay Model

Late-payment probability answers:

> Is this invoice likely to be late?

It does not answer:

> If it is late, how late might it be?

DueSignal therefore trains a second model using `GradientBoostingRegressor`.

Its target is `delay_days`, and its main evaluation metric is mean absolute error:

$$
\text{MAE}
==========

\frac{1}{N}
\sum_{i=1}^{N}
|\hat{y}_i-y_i|
$$

The baseline predicts the median training delay for every evaluation invoice.

```python
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error


payment_delay_model = Pipeline(
    steps=[
        ("preprocessor", preprocessor),
        (
            "regressor",
            GradientBoostingRegressor(
                random_state=42,
            ),
        ),
    ]
)

payment_delay_model.fit(
    X_train,
    train["delay_days"],
)

predicted_delay = payment_delay_model.predict(
    X_test
)

regressor_mae = mean_absolute_error(
    test["delay_days"],
    predicted_delay,
)

baseline_delay = train["delay_days"].median()

baseline_delay_predictions = np.full(
    len(test),
    baseline_delay,
)

baseline_mae = mean_absolute_error(
    test["delay_days"],
    baseline_delay_predictions,
)
```

The classifier and regressor provide complementary signals:

* Probability that the invoice will be late
* Estimated delay relative to its due date

These can later support cash-receipt forecasting and collection planning.

## From Predictions to Collection Priorities

A high late-payment probability does not automatically make an invoice the highest collection priority.

Consider two invoices:

| Invoice | Late probability |  Amount | Due date   |
| ------- | ---------------: | ------: | ---------- |
| A       |              90% |    $150 | In 25 days |
| B       |              65% | $48,000 | Overdue    |

Invoice A is more likely to be late, but invoice B may deserve immediate attention because of its value and urgency.

DueSignal therefore keeps the model prediction separate from the operational collection score.

The priority score combines:

* **45%** late-payment probability
* **25%** amount percentile within currency
* **25%** due-date urgency
* **5%** reminder pressure

$$
\text{Priority}
===============

0.45P(\text{late})
+
0.25A
+
0.25U
+
0.05R
$$

where:

* $(P(\text{late}))$ is the model probability
* $(A)$ is the amount percentile within currency
* $(U)$ is normalized due-date urgency
* $(R)$ is normalized reminder pressure

The following code illustrates the calculation:

```python
def add_collection_priority(
    open_invoices: pd.DataFrame,
    as_of_date: pd.Timestamp,
) -> pd.DataFrame:
    ranked = open_invoices.copy()

    ranked["amount_percentile"] = (
        ranked.groupby("currency")["amount"]
        .rank(method="average", pct=True)
    )

    days_to_due = (
        ranked["due_date"] - as_of_date
    ).dt.days

    # An invoice due in 30 days has low urgency.
    # An invoice due today or overdue approaches 1.
    ranked["due_date_urgency"] = np.clip(
        (30 - days_to_due) / 30,
        0,
        1,
    )

    ranked["reminder_pressure"] = np.clip(
        ranked["reminders_sent"]
        .fillna(0)
        .astype(float)
        / 3,
        0,
        1,
    )

    ranked["collection_priority"] = (
        0.45 * ranked["late_probability"]
        + 0.25 * ranked["amount_percentile"]
        + 0.25 * ranked["due_date_urgency"]
        + 0.05 * ranked["reminder_pressure"]
    )

    return ranked.sort_values(
        "collection_priority",
        ascending=False,
    )
```

The normalization functions can be adjusted to match the organization’s collection policy. The important architectural decision is that the formula remains understandable.

A collections manager should be able to see why an invoice appears near the top:

* High predicted late-payment risk
* Large relative invoice value
* Due soon or already overdue
* Multiple previous reminders

The ranking is not presented as a mysterious second machine-learning model. It is an explicit business rule built around a model prediction.

## Why the Separation Matters

Keeping probability prediction and collection prioritization separate provides several benefits.

### The prediction remains temporally valid

The classifier only uses issue-time information. Live operational fields do not contaminate model evaluation.

### Business policy remains adjustable

A company can change the priority weights without retraining the classifier.

For example, it might increase the amount component during a cash-flow shortage or increase urgency near the end of a reporting period.

### The queue is easier to explain

Users can understand the contribution of risk, value, urgency, and reminder activity.

### Model monitoring remains meaningful

The classifier can be evaluated against actual late-payment outcomes without confusing model quality with downstream workflow rules.

## Monitoring the Model After Deployment

A successful historical evaluation does not guarantee permanent performance.

Customer behavior, payment policies, markets, and invoice composition can change.

DueSignal therefore treats model metrics as training records rather than one-time notebook outputs.

Each training run can record:

* Training-period boundaries
* Evaluation-period boundaries
* Number of resolved invoices
* Late-payment prevalence
* Classifier ROC-AUC
* Classifier Brier score
* Classifier baseline Brier score
* Regressor MAE
* Regressor baseline MAE
* Feature and model versions

Over time, the application can compare current outcomes with the predictions that were originally made.

Important monitoring questions include:

* Has the observed late-payment rate changed?
* Are predicted probabilities still calibrated?
* Is the Brier score getting worse?
* Has the model stopped beating its baseline?
* Are invoice amounts or payment terms drifting?
* Are more predictions being made for customers without history?
* Has the distribution of currencies or industries changed?

Retraining should be driven by evidence, not by an arbitrary schedule alone.

## Lessons Learned

Building the DueSignal predictor reinforced several lessons that apply far beyond invoice data.

### Temporal validity matters more than impressive metrics

A lower but honest chronological score is more valuable than an inflated random-split score.

### Customer history must be reconstructed

Aggregating a customer’s entire dataset history is easy. Reconstructing what was actually known at each prediction date is the real modeling task.

### Ranking and probability quality are different

ROC-AUC measures whether risky invoices rise to the top. It does not guarantee that a predicted 80% risk really behaves like 80%.

### Baselines are part of the model

A model should not be deployed merely because it is more sophisticated than a constant prediction. It should prove that it improves on the constant prediction.

### Predictions need an operational layer

A probability becomes useful only when connected to invoice value, urgency, and collection workflow.

### Explainability can begin with system design

Not every explanation requires a complex attribution algorithm. Separating model risk from explicit business weights already makes the result substantially easier to understand.

## Final Pipeline

The complete DueSignal modeling flow can be summarized as:

```text
CSV invoice import
        ↓
Schema and business-rule validation
        ↓
Target creation for resolved invoices
        ↓
Issue-time feature reconstruction
        ↓
Chronological train/test split
        ↓
Scikit-learn preprocessing pipeline
        ↓
Gradient boosting classifier and regressor
        ↓
ROC-AUC, Brier score, calibration, and MAE
        ↓
Comparison against chronological baselines
        ↓
Model promotion
        ↓
Predictions for open invoices
        ↓
Risk + value + urgency + reminder pressure
        ↓
Prioritized collection queue
```

The classifier itself is only one part of the solution.

The more important work lies in defining when the prediction occurs, reconstructing the information available at that moment, evaluating probabilities honestly, and converting the output into a decision that someone can act on.

That is the difference between training an invoice classifier and building a late-payment prediction product.
