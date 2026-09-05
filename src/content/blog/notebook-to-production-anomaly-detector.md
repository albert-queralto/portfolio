---
title: "From Notebook to Production: Deploying an Anomaly Detector"
description: "Lessons from moving anomaly-detection work for real-time environmental time series beyond model experiments into an interpretable operational workflow."
date: 2026-12-08
publishAt: 2026-12-08T08:00:00+02:00
tags: ["Machine Learning", "Anomaly Detection", "MLOps", "Time Series", "FastAPI", "Explainability"]
draft: false
cover: "/og/notebook-to-production-anomaly-detector.png"
featured: false
---

Building an anomaly detector in a notebook and operating one against real-time data are two very different engineering problems.

In a notebook, I can assume:

```text
the dataset already exists
columns are stable
timestamps are clean
labels are available
the model runs when I ask it to
```

In an operational monitoring system, none of those assumptions are guaranteed.

That gap became particularly clear while working with real-time environmental and water-system time-series data.

One contamination-event detector I developed achieved **more than 80% detection capability**, but getting a useful model was only part of the work.

The real challenge was creating a system whose output could be interpreted and acted on.

## Start by defining an event

A common anomaly-detection mistake is beginning with the algorithm.

I prefer starting with the event.

For an operational monitoring system I need to define:

```text
What counts as an anomaly?
When does it begin?
When does it end?
How much warning is useful?
What level of false alarms can operators tolerate?
```

Point-level accuracy often answers the wrong question.

Suppose a contamination event lasts 30 minutes and produces 30 anomalous samples.

A detector that identifies 29 of them has high sample-level recall.

A detector that identifies only one early sample may still successfully detect the event operationally.

Conversely, detecting 20 samples after the event is already obvious may offer little value.

The metric needs to reflect the real decision.

## Time-series validation must remain temporal

As with invoice models, random row-level splitting is dangerous.

Nearby time-series observations are highly correlated.

If adjacent windows from the same physical event appear in both training and validation sets, the evaluation becomes optimistic.

I prefer splitting by meaningful temporal blocks or events so that the model must generalize to periods it has not seen.

Conceptually:

```text
past operational period    -> training
later operational period   -> validation
future events              -> evaluation
```

If labels are event based, entire events should remain on one side of the split.

## The data pipeline is part of the detector

A deployed anomaly model does not receive a pandas DataFrame from a notebook.

It receives operational data.

That can involve:

- API feeds,
- FTP files,
- sensor databases,
- hydrological sources,
- meteorological sources,
- and scheduled ingestion.

Before inference, the system needs predictable handling for:

- missing samples,
- duplicate timestamps,
- delayed observations,
- out-of-range values,
- unit changes,
- sensor downtime,
- and schema changes.

Otherwise the model starts detecting problems in the data pipeline rather than the physical process.

Some of those problems are still worth alerting on—but they should be distinguishable from actual environmental events.

## Feature engineering must survive streaming

Notebook features are easy to calculate when the entire dataset is visible.

Production features need a causal interpretation.

For a prediction at time \(t\), every feature must be computable from information available at or before \(t\).

Time-series features may include:

- rolling means,
- rolling variability,
- rates of change,
- lagged values,
- cross-sensor differences,
- and deviation from expected behavior.

The production implementation needs to reproduce the same window definitions and preprocessing used during training.

A one-row difference in a rolling calculation can create a model that is technically "the same" but operationally different.

## Thresholds are product decisions

Many anomaly models produce a continuous score.

The alert requires a threshold.

That threshold determines a trade-off:

```text
lower threshold
    -> higher sensitivity
    -> more false alarms

higher threshold
    -> fewer false alarms
    -> more missed events
```

There is no universally correct value.

Operators often care about false-alarm burden as much as machine-learning recall.

A detector that finds every anomaly but sends an alert every five minutes will eventually be ignored.

Threshold selection therefore belongs in validation and operational review, not as an arbitrary constant chosen after training.

## Explanations matter in monitoring

An anomaly alert without context forces the operator to begin their own investigation from zero.

I have used SHAP to help interpret model predictions.

The goal is not to pretend that feature attribution proves causality.

It is to provide supporting information such as:

- which variables contributed most,
- which signals changed unusually,
- which direction they moved,
- and how the current pattern differs from expected behavior.

That can turn:

> anomaly score = 0.91

into:

> conductivity and turbidity moved outside their normal joint pattern while the other monitored signals remained comparatively stable.

The second output is much more actionable.

## Package the model as a system

A production model needs a repeatable interface.

That may mean a FastAPI service or another application boundary capable of exposing operations such as:

```text
load model configuration
submit observation window
run inference
return score
return explanation
return model metadata
```

The application should also know which model version produced the result.

Reproducibility requires more than saving:

```text
model.pkl
```

Useful metadata includes:

- model version,
- feature configuration,
- training period,
- threshold,
- input schema,
- scaler or preprocessor,
- and evaluation metrics.

The prediction is only reproducible if its preprocessing and configuration are reproducible.

## Configuration becomes a product problem

Once several models exist, manually editing configuration files stops scaling.

I have built Streamlit and FastAPI tools around model configuration, migration and visualization.

That layer matters because operational machine learning usually involves more than one researcher.

Eventually someone needs to answer:

```text
Which model is active?
Which sensors does it use?
What threshold is configured?
When was it trained?
How is it performing?
```

A model registry does not need to begin as a huge MLOps platform.

It needs to make state explicit.

## Monitoring should include the inputs

Model accuracy can degrade while the API remains perfectly healthy.

Production monitoring therefore needs two levels.

### System health

```text
service available
inference latency
data arriving
scheduled jobs healthy
database accessible
```

### Model health

```text
input distribution
missingness
score distribution
alert frequency
observed event detection
false alarms
feature drift
```

A `200 OK` response only tells me the software executed.

It does not tell me that the prediction remains useful.

## Feedback closes the loop

Environmental anomalies are especially difficult because labels may arrive late and expert review matters.

An operational workflow should preserve:

```text
prediction timestamp
anomaly score
threshold decision
model version
operator assessment
confirmed event outcome
```

That creates the evidence needed to evaluate the detector later.

Without that connection, deployed machine learning becomes a stream of predictions with no long-term learning mechanism.

## What changed from the notebook

The model itself remained important.

But its relative importance became smaller.

The production system also needed:

```text
reliable ingestion
temporal validation
causal feature calculation
threshold management
versioning
interpretability
APIs
configuration tools
monitoring
feedback
```

Those pieces determine whether the detector survives contact with real operational data.

That is the biggest lesson I have taken from applied anomaly-detection work.

A notebook demonstrates that a model can find a pattern.

A production system needs to demonstrate that the pattern can become a reliable decision.
