---
title: "Detección de anomalías en series temporales con LSTM"
description: "Cómo construir un pipeline robusto de detección de anomalías para datos multivariantes de sensores con autoencoders LSTM en PyTorch, incluyendo selección de umbrales y despliegue."
date: 2026-04-22
lang: es
translationKey: lstm-anomaly-detection
tags: ["Time Series", "LSTM", "Anomaly Detection", "PyTorch", "MLOps"]
draft: false
---

## El problema

Los sensores industriales generan flujos continuos de datos de series temporales multivariantes. Detectar pronto anomalías —lecturas defectuosas, degradación de equipos o drift del proceso— puede evitar fallos costosos.

El reto es que las anomalías son poco frecuentes, a menudo no están etiquetadas y adoptan formas diferentes según el tipo de sensor y las condiciones operativas.

## ¿Por qué LSTM?

Las LSTM (Long Short-Term Memory) destacan al modelar dependencias temporales. Un **autoencoder LSTM** aprende a reconstruir secuencias normales durante el entrenamiento. En inferencia, un error de reconstrucción alto indica una anomalía.

Este enfoque no supervisado funciona bien cuando:
- Hay pocos datos de anomalías etiquetados o no están disponibles
- El régimen "normal" está bien definido y es relativamente estacionario

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

## Implementación en PyTorch

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

## Selección del umbral

La distribución del error de reconstrucción en el conjunto de entrenamiento orienta el umbral de anomalía. Una heurística habitual es:

$$\tau = \mu_{train} + k \cdot \sigma_{train}$$

donde $k$ suele estar entre 2 y 4. Debe elegirse $k$ sobre un conjunto de validación para equilibrar precision y recall según el caso de uso.

En la práctica, un percentil móvil (por ejemplo, el 99) de los errores recientes es más robusto frente al concept drift que un $\tau$ fijo.

## Consejos de entrenamiento

1. **Normaliza por canal** — estandariza cada sensor a media cero y varianza unitaria
2. **Ventanas deslizantes** — divide la serie temporal en ventanas solapadas de longitud $T$ (por ejemplo, 50–200 pasos)
3. **Gradient clipping** — `torch.nn.utils.clip_grad_norm_` evita gradientes explosivos
4. **Early stopping** — monitoriza la pérdida de reconstrucción de validación con una paciencia de 10–20 épocas

## Despliegue con MLflow

```python
import mlflow
import mlflow.pytorch

with mlflow.start_run():
    mlflow.log_params({"hidden_dim": 64, "n_layers": 2, "seq_len": 100})
    # ... training loop ...
    mlflow.log_metric("val_mse", val_loss)
    mlflow.pytorch.log_model(model, "lstm_autoencoder")
```

Registrar la distribución del error de reconstrucción como artefacto permite auditar la elección de umbrales y comparar ejecuciones entre experimentos.

## Limitaciones

- Los autoencoders LSTM asumen estacionariedad; el concept drift requiere reentrenamiento periódico
- Alternativas basadas en atención con coste $O(n^2)$ (Transformers, Informer) escalan mejor para secuencias muy largas
- El error de reconstrucción es un escalar; el error por variable puede ayudar a localizar qué sensor es anómalo

## Resumen

Los autoencoders LSTM son un baseline práctico y desplegable para detección no supervisada de anomalías en series temporales. No requieren etiquetas de anomalía, generalizan entre tipos de sensores con normalización y se integran de forma natural en pipelines MLOps. En sistemas de producción, deben combinarse con una estrategia robusta de umbrales y monitorización de cambios de distribución.
