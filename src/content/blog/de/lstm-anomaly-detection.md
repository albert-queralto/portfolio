---
title: "Zeitreihen-Anomalieerkennung mit LSTMs"
description: "Wie sich mit LSTM-Autoencodern in PyTorch eine robuste Anomalieerkennungs-Pipeline für multivariate Sensordaten aufbauen lässt – inklusive Schwellenwertwahl und Deployment."
date: 2026-04-22
lang: de
translationKey: lstm-anomaly-detection
tags: ["Time Series", "LSTM", "Anomaly Detection", "PyTorch", "MLOps"]
draft: false
---

## Das Problem

Industrielle Sensoren erzeugen kontinuierliche Ströme multivariater Zeitreihendaten. Anomalien — fehlerhafte Messwerte, Anlagenverschleiß oder Prozessdrift — früh zu erkennen kann kostspielige Ausfälle verhindern.

Die Herausforderung: Anomalien sind selten, häufig ungelabelt und sehen je nach Sensortyp und Betriebsbedingung unterschiedlich aus.

## Warum LSTMs?

LSTMs (Long Short-Term Memory) eignen sich besonders für zeitliche Abhängigkeiten. Ein **LSTM-Autoencoder** lernt im Training, normale Sequenzen zu rekonstruieren. Bei der Inferenz signalisiert ein hoher Rekonstruktionsfehler eine Anomalie.

Dieser unüberwachte Ansatz funktioniert gut, wenn:
- gelabelte Anomaliedaten knapp oder nicht verfügbar sind
- der "normale" Zustand klar definiert und relativ stationär ist

## Architektur

```
Input (T, features)
       ↓
  LSTM Encoder  →  Bottleneck (compressed context)
       ↓
  LSTM Decoder  →  Reconstructed sequence
       ↓
Reconstruction error (MSE per timestep)
```

## PyTorch-Implementierung

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

## Schwellenwertwahl

Die Verteilung des Rekonstruktionsfehlers im Trainingssatz liefert eine Grundlage für den Anomalieschwellenwert. Eine häufige Heuristik ist:

$$\tau = \mu_{train} + k \cdot \sigma_{train}$$

wobei $k$ typischerweise zwischen 2 und 4 liegt. $k$ sollte auf einem Validierungssatz so gewählt werden, dass Precision und Recall zum Anwendungsfall passen.

In der Praxis ist ein rollendes Perzentil (z. B. das 99.) der jüngsten Fehler robuster gegenüber Concept Drift als ein fester $\tau$.

## Trainingstipps

1. **Pro Kanal normalisieren** — jeden Sensor auf Mittelwert null und Varianz eins standardisieren
2. **Sliding Windows** — Zeitreihe in überlappende Fenster der Länge $T$ teilen (z. B. 50–200 Schritte)
3. **Gradient Clipping** — `torch.nn.utils.clip_grad_norm_` verhindert explodierende Gradienten
4. **Early Stopping** — Rekonstruktionsverlust auf dem Validierungssatz überwachen, mit einer Geduld von 10–20 Epochen

## Deployment mit MLflow

```python
import mlflow
import mlflow.pytorch

with mlflow.start_run():
    mlflow.log_params({"hidden_dim": 64, "n_layers": 2, "seq_len": 100})
    # ... training loop ...
    mlflow.log_metric("val_mse", val_loss)
    mlflow.pytorch.log_model(model, "lstm_autoencoder")
```

Die Verteilung des Rekonstruktionsfehlers als Artefakt zu protokollieren erleichtert die Auditierung der Schwellenwertwahl und den Vergleich verschiedener Experimente.

## Einschränkungen

- LSTM-Autoencoder nehmen Stationarität an; Concept Drift erfordert regelmäßiges Retraining
- Attention-basierte Alternativen mit $O(n^2)$ Kosten (Transformers, Informer) skalieren besser für sehr lange Sequenzen
- Rekonstruktionsfehler ist ein Skalar; Fehler pro Feature können helfen, den anomalen Sensor zu lokalisieren

## Zusammenfassung

LSTM-Autoencoder sind eine praktische, deploybare Baseline für unüberwachte Anomalieerkennung in Zeitreihen. Sie benötigen keine Anomalielabels, lassen sich durch Normalisierung auf verschiedene Sensortypen übertragen und passen sauber in MLOps-Pipelines. In Produktionssystemen sollten sie mit einer robusten Schwellenwertstrategie kombiniert und auf Verteilungsverschiebungen überwacht werden.
