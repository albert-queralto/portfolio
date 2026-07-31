---
title: "Time Series Anomaly Detection with LSTMs"
description: "How to build a robust anomaly detection pipeline for multivariate sensor data using LSTM autoencoders in PyTorch, with practical tips on thresholding and deployment."
date: 2026-04-22
tags: ["Time Series", "LSTM", "Anomaly Detection", "PyTorch", "MLOps"]
draft: false
---

## The Problem

Industrial sensors generate continuous streams of multivariate time-series data. Detecting anomalies — faulty readings, equipment degradation, process drift — early can prevent costly failures.

The challenge: anomalies are rare, often unlabelled, and look different across sensor types and operating conditions.

## Why LSTMs?

LSTMs (Long Short-Term Memory networks) excel at modelling temporal dependencies. An **LSTM autoencoder** learns to reconstruct normal sequences during training. At inference time, high reconstruction error signals an anomaly.

This unsupervised approach works well when:
- Labelled anomaly data is scarce or unavailable
- The "normal" regime is well-defined and relatively stationary

## Architecture

```
Input (T, features)
       ↓
  LSTM Encoder  →  Bottleneck (compressed context)
       ↓
  LSTM Decoder  →  Reconstructed sequence
       ↓
Reconstruction error (MSE per timestep)
```

## PyTorch Implementation

```python
import torch
import torch.nn as nn

class LSTMAutoencoder(nn.Module):
    def __init__(self, n_features: int, hidden_dim: int = 64, n_layers: int = 2):
        super().__init__()
        self.encoder = nn.LSTM(n_features, hidden_dim, n_layers, batch_first=True)
        self.decoder = nn.LSTM(hidden_dim, hidden_dim, n_layers, batch_first=True)
        self.fc = nn.Linear(hidden_dim, n_features)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (batch, seq_len, n_features)
        _, (h, c) = self.encoder(x)
        # Repeat bottleneck across time steps for decoder input
        seq_len = x.size(1)
        decoder_input = h[-1].unsqueeze(1).repeat(1, seq_len, 1)
        out, _ = self.decoder(decoder_input, (h, c))
        return self.fc(out)
```

## Threshold Selection

The reconstruction error distribution on the training set guides the anomaly threshold. A common heuristic:

$$\tau = \mu_{train} + k \cdot \sigma_{train}$$

where $k$ is typically between 2 and 4. Choose $k$ on a validation set to balance precision and recall for your use case.

In practice, a rolling percentile (e.g. 99th) of recent errors is more robust to concept drift than a fixed $\tau$.

## Training Tips

1. **Normalise per-channel** — standardise each sensor to zero mean and unit variance
2. **Sliding windows** — split the time series into overlapping windows of length $T$ (e.g. 50–200 steps)
3. **Gradient clipping** — `torch.nn.utils.clip_grad_norm_` prevents exploding gradients
4. **Early stopping** — monitor validation reconstruction loss, patience of 10–20 epochs

## Deployment with MLflow

```python
import mlflow
import mlflow.pytorch

with mlflow.start_run():
    mlflow.log_params({"hidden_dim": 64, "n_layers": 2, "seq_len": 100})
    # ... training loop ...
    mlflow.log_metric("val_mse", val_loss)
    mlflow.pytorch.log_model(model, "lstm_autoencoder")
```

Logging the reconstruction error distribution as an artifact lets you audit threshold choices and compare runs across experiments.

## Limitations

- LSTM autoencoders assume stationarity — concept drift requires periodic retraining
- $O(n^2)$ attention-based alternatives (Transformers, Informer) scale better to very long sequences
- Reconstruction error is a scalar; per-feature error can help localise which sensor is anomalous

## Summary

LSTM autoencoders are a practical, deployable baseline for unsupervised time-series anomaly detection. They require no anomaly labels, generalise across sensor types with normalisation, and integrate cleanly into MLOps pipelines. For production systems, combine them with a robust thresholding strategy and monitor for distribution shift.
