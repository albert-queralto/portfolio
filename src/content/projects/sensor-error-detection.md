---
title: "Sensor Error Detection and Localisation with RNNs"
description: "A recurrent-neural-network pipeline using LSTM and GRU models to detect and localise faults in multivariate sensor streams."
order: 3
featured: false
draft: false
status: "Completed"
category: "Machine Learning"
focus: "Deep learning · Time series"
image: "/Sensor_Error_Detection_and_Localization_with_RNNs.png"
source: "https://github.com/albert-queralto/Sensor_Error_Detection_and_Localization_with_RNNs"
technologies:
  - Python
  - PyTorch
  - LSTM
  - GRU
  - Time series
metrics:
  - label: "Problem type"
    value: "Multivariate fault detection"
  - label: "Model families"
    value: "LSTM + GRU"
  - label: "Output"
    value: "Detection + localisation"
---

## Problem

Industrial and environmental monitoring systems rely on multiple sensors that produce correlated measurements over time. A faulty sensor can distort downstream analysis, trigger false alarms, or hide a real operational event.

The project explores how recurrent neural networks can detect when a sensor stream becomes abnormal and identify which sensor is responsible. The intended users are engineers and analysts responsible for maintaining reliable multivariate monitoring systems.

## Constraints

Sensor faults are temporal rather than isolated tabular events. A suspicious value may only be identifiable from its relationship with earlier observations and with the simultaneous behavior of other sensors.

Fault examples may be less common than normal observations, creating an imbalanced learning problem. Different fault types can also produce similar symptoms, and the same sensor can behave differently under changing operating conditions.

The project is experimental rather than a deployed monitoring service, so its evaluation focuses on model behavior and comparative performance instead of production latency or infrastructure availability.

## Approach

The data is organized as multivariate sequences suitable for recurrent neural networks. LSTM and GRU architectures are trained to learn temporal dependencies and cross-sensor relationships.

The pipeline separates two related tasks: detecting whether a sequence contains a sensor error and localising the affected sensor. Data preparation includes sequence construction, feature scaling, target generation, and train/evaluation separation.

Comparing LSTM and GRU models helps assess whether the additional gating complexity of an LSTM provides enough benefit for the selected data and sequence length.

## Validation

The models are evaluated on held-out sequences that are not used during training. Evaluation considers whether faults are detected and whether the correct sensor is identified.

Because normal observations can dominate the dataset, class-sensitive measures are more informative than accuracy alone. Confusion matrices and per-class behavior help reveal whether a model performs well across sensors or only on the most frequent fault patterns.

The repository contains the reproducible analysis and model experiments used to compare architectures and training configurations.

## Engineering decisions

PyTorch is used to define the recurrent architectures and training loop explicitly. This makes hidden-state handling, sequence shapes, optimization, and evaluation behavior visible rather than hiding them behind a higher-level abstraction.

The project keeps data preparation, model definition, training, and evaluation logically separated so individual stages can be inspected and modified. Reproducible configuration and fixed random seeds are important when comparing recurrent models.

Visual diagnostics are used alongside summary metrics to inspect training behavior and model errors.

## Tradeoffs

The project focuses on LSTM and GRU architectures instead of testing every possible time-series method. Simpler statistical baselines and newer sequence architectures could provide useful additional comparisons.

The experimental pipeline does not yet include a streaming inference API, persistent model registry, automated drift detection, or an operator-facing alert interface.

## Next steps

A stronger next version would add non-recurrent baselines, temporal cross-validation, threshold optimization, and a clearer comparison between detection and localisation errors.

For production use, the model could be packaged behind a FastAPI service, connected to a streaming data source, monitored for data drift, and integrated with an alerting interface that shows the affected sensor and supporting evidence.
