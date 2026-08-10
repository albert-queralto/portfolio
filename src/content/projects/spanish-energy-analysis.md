---
title: "Spanish Energy Price Analysis"
description: "Exploratory and statistical analysis of Spanish electricity-market prices, seasonal behavior, and potential price drivers."
order: 8
featured: false
draft: false
status: "Completed"
category: "Data Science"
focus: "EDA · Statistical modelling"
image: "/energy_prices.png"
source: "https://github.com/albert-queralto/analysis_energy_prices"
technologies:
  - Python
  - Pandas
  - Matplotlib
  - Statsmodels
metrics:
  - label: "Analysis type"
    value: "Exploratory + statistical"
  - label: "Primary domain"
    value: "Spanish electricity market"
  - label: "Temporal focus"
    value: "Seasonality and price drivers"
---

## Problem

Electricity prices vary with demand, generation mix, seasonality, market conditions, and external events. Raw time-series values alone do not explain when prices change or which factors may move together.

This project analyzes Spanish electricity-market prices to identify temporal patterns, visualize periods of volatility, and investigate relationships with candidate explanatory variables.

The work is intended as an analytical foundation for reporting, forecasting, and further energy-market research.

## Constraints

Energy time series contain strong temporal dependence, multiple seasonal cycles, outliers, missing periods, and structural changes. Relationships observed in exploratory analysis do not automatically imply causation.

Variables may use different frequencies or timestamps and must be aligned before comparison. Price distributions can be highly skewed, making averages alone insufficient.

Any predictive interpretation must respect chronological order rather than using random train/test splits.

## Approach

Pandas is used to clean, align, aggregate, and reshape the data. Matplotlib supports time-series, distribution, and relationship visualizations, while Statsmodels provides statistical tools for trend and temporal analysis.

The analysis begins with data-quality checks and descriptive statistics, then examines hourly, daily, monthly, and seasonal behavior. Candidate drivers are compared with price movements through plots and statistical summaries.

The workflow distinguishes exploratory observations from stronger statistical claims and records assumptions made during transformation.

## Validation

Date ranges, frequencies, missing timestamps, duplicates, and units are checked before analysis. Aggregated values are compared with the underlying observations to ensure transformations preserve the intended meaning.

Statistical models are inspected through residual behavior and time-aware validation where prediction is involved. Sensitivity to outliers and unusual market periods is considered when interpreting summary statistics.

Charts are reviewed for misleading scales, inconsistent time aggregation, and accidental mixing of variables with different units.

## Engineering decisions

The project is structured as a reproducible Python analysis rather than a collection of disconnected manual calculations. Data preparation is separated from visualization and modeling so the same cleaned dataset can support several analytical views.

Statsmodels is used where interpretable statistical output is more valuable than a black-box predictor. Source code and figures are version-controlled in the repository.

The project complements the separate energy-ingestion pipeline, which handles data collection and persistence.

## Tradeoffs

The analysis emphasizes interpretability and exploration rather than building a production forecasting service. It does not claim that correlated variables are causal drivers.

External explanatory data and major market interventions may not be represented fully. A more comprehensive analysis would require richer exogenous variables and explicit treatment of regime changes.

## Next steps

The next stage could combine the analysis with the automated ingestion pipeline and create a continuously updated dataset and dashboard.

Further work could add time-series forecasting baselines, rolling-origin evaluation, uncertainty intervals, regime-change analysis, and comparisons between classical statistical models and gradient-boosting approaches.
