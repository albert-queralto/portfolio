---
title: "Detecció d'anomalies en sèries temporals amb LSTM"
description: "Com construir un pipeline robust de detecció d'anomalies per a dades multivariants de sensors amb autoencoders LSTM en PyTorch, incloent selecció de llindars i desplegament."
date: 2026-04-22
lang: ca
translationKey: lstm-anomaly-detection
tags: ["Time Series", "LSTM", "Anomaly Detection", "PyTorch", "MLOps"]
draft: false
---

## El problema

Els sensors industrials generen fluxos continus de dades de sèries temporals multivariants. Detectar aviat anomalies —lectures defectuoses, degradació d'equipament o drift del procés— pot evitar fallades costoses.

El repte és que les anomalies són rares, sovint no estan etiquetades i adopten formes diferents segons el tipus de sensor i les condicions operatives.

## Per què LSTM?

Les LSTM (Long Short-Term Memory) destaquen modelant dependències temporals. Un **autoencoder LSTM** aprèn a reconstruir seqüències normals durant l'entrenament. En inferència, un error de reconstrucció elevat indica una anomalia.

Aquest enfocament no supervisat funciona bé quan:
- Hi ha poques dades d'anomalies etiquetades o no n'hi ha
- El règim "normal" està ben definit i és relativament estacionari

## Arquitectura

```
Input (T, features)
       ↓
  LSTM Encoder  →  Bottleneck (compressed context)
       ↓
  LSTM Decoder  →  Reconstructed sequence
       ↓
Reconstruction error (MSE per timestep)
```

## Implementació en PyTorch

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

## Selecció del llindar

La distribució de l'error de reconstrucció al conjunt d'entrenament orienta el llindar d'anomalia. Una heurística habitual és:

$$\tau = \mu_{train} + k \cdot \sigma_{train}$$

on $k$ sol estar entre 2 i 4. Cal triar $k$ sobre un conjunt de validació per equilibrar precisió i recall segons el cas d'ús.

A la pràctica, un percentil mòbil (per exemple, el 99) dels errors recents és més robust davant del concept drift que un $\tau$ fix.

## Consells d'entrenament

1. **Normalitza per canal** — estandarditza cada sensor a mitjana zero i variància unitària
2. **Finestres lliscants** — divideix la sèrie temporal en finestres solapades de longitud $T$ (per exemple, 50–200 passos)
3. **Gradient clipping** — `torch.nn.utils.clip_grad_norm_` evita gradients explosius
4. **Early stopping** — monitoritza la pèrdua de reconstrucció de validació amb una paciència de 10–20 èpoques

## Desplegament amb MLflow

```python
import mlflow
import mlflow.pytorch

with mlflow.start_run():
    mlflow.log_params({"hidden_dim": 64, "n_layers": 2, "seq_len": 100})
    # ... training loop ...
    mlflow.log_metric("val_mse", val_loss)
    mlflow.pytorch.log_model(model, "lstm_autoencoder")
```

Registrar la distribució de l'error de reconstrucció com a artefacte permet auditar l'elecció de llindars i comparar execucions entre experiments.

## Limitacions

- Els autoencoders LSTM assumeixen estacionarietat; el concept drift requereix reentrenament periòdic
- Alternatives basades en atenció amb cost $O(n^2)$ (Transformers, Informer) escalen millor per a seqüències molt llargues
- L'error de reconstrucció és un escalar; l'error per variable pot ajudar a localitzar quin sensor és anòmal

## Resum

Els autoencoders LSTM són un baseline pràctic i desplegable per a detecció no supervisada d'anomalies en sèries temporals. No requereixen etiquetes d'anomalia, generalitzen entre tipus de sensors amb normalització i s'integren de manera natural en pipelines MLOps. En sistemes de producció, cal combinar-los amb una estratègia robusta de llindars i monitorar canvis de distribució.
