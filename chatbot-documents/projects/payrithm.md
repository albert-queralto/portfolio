---
title: "Payrithm"
description: "An accounts-receivable intelligence platform that predicts late payments, estimates payment timing, forecasts cash receipts, and prioritizes collection work."
order: 1
featured: true
draft: false
status: "In progress"
category: "Machine Learning"
focus: "ML SaaS · Financial operations"
image: "/projects/payrithm/payrithm.png"
article: "/blog/payrithm"
source: "https://github.com/albert-queralto/invoice-late-predictor-enterprise"
preview: "https://payrithm.albertqueralto.dev/"
technologies:
  - Python
  - FastAPI
  - scikit-learn
  - React
  - TypeScript
  - PostgreSQL
  - Celery
  - Redis
  - Docker
metrics:
  - label: "Prediction tasks"
    value: "Classification + regression"
  - label: "Validation"
    value: "Chronological holdout"
  - label: "Architecture"
    value: "Multi-service SaaS"
---

## The problem

Accounts-receivable teams may need to manage hundreds or thousands of open
invoices without knowing which ones are most likely to be paid late.

Treating every invoice equally wastes collection capacity. Payrithm is designed
to identify risk early and convert that risk into a clear operational queue.

## My approach

Payrithm uses two related machine-learning models:

- A classifier estimates the probability that an invoice will be paid late.
- A regressor estimates payment delay relative to the due date.

The system separates issue-time model features from live operational signals.
This prevents current overdue status, future reminders, and final payment
information from leaking into model training.

## Data preparation

The import pipeline validates identifiers, invoice amounts, currencies, issue
dates, due dates, and payment dates before records become training examples.

Customer-history features are reconstructed as of each invoice's issue date.
Only outcomes known before that date are included.

## Validation

The latest portion of resolved invoices forms the evaluation period. Earlier
invoices form the training period.

This chronological split reproduces the real deployment direction: train on the
past and predict future invoices.

The classifier is evaluated using:

- ROC-AUC for ranking quality
- Brier score for probability quality
- Calibration analysis
- A constant-probability baseline

The regression model is evaluated using mean absolute error and a median-delay
baseline.

## Turning predictions into decisions

The final collection score combines:

- Late-payment probability
- Invoice amount percentile within its currency
- Due-date urgency
- Reminder pressure

Keeping this formula separate from the model makes business policy adjustable
and allows users to understand why an invoice appears near the top of the queue.

## Architecture

The application separates the frontend, API, application services, background
workers, persistence layer, and machine-learning pipeline.

This makes imports and model training asynchronous while keeping the API
responsive.

## Current status

The main application modules are implemented. The next steps are to complete
production evaluation, publish final model metrics, expand monitoring, and
collect feedback from potential users.