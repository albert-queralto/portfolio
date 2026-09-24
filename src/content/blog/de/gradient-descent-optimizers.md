---
title: "Gradient-Descent-Optimierer: von SGD bis Adam"
description: "Ein praktischer Leitfaden zu den verbreitetsten Optimierungsalgorithmen im Deep Learning – was sie berechnen, warum sie sich unterscheiden und wann welcher sinnvoll ist."
date: 2026-03-25
lang: de
translationKey: gradient-descent-optimizers
tags: ["Deep Learning", "Optimization", "PyTorch", "Training"]
draft: false
---

## Das Kernproblem

Ein neuronales Netz zu trainieren bedeutet, eine Verlustfunktion $\mathcal{L}(\theta)$ über potenziell Milliarden Parameter $\theta$ zu minimieren. Gradient Descent tut dies iterativ:

$$\theta_{t+1} = \theta_t - \eta \nabla_\theta \mathcal{L}(\theta_t)$$

wobei $\eta$ die Lernrate ist. Die Herausforderung: Den vollständigen Gradienten über den gesamten Datensatz zu berechnen ist zu teuer — deshalb verwenden wir **stochastische** Varianten.

## Stochastic Gradient Descent (SGD)

SGD berechnet den Gradienten auf einem zufälligen Mini-Batch der Größe $B$:

$$\theta_{t+1} = \theta_t - \eta \nabla_\theta \mathcal{L}_B(\theta_t)$$

Das führt Rauschen ein, doch dieses Rauschen wirkt als Regularisierer und kann helfen, scharfen Minima zu entkommen. Mit **Momentum** akkumulieren wir einen Geschwindigkeitsvektor:

$$v_{t+1} = \mu v_t - \eta \nabla \mathcal{L}_B(\theta_t)$$
$$\theta_{t+1} = \theta_t + v_{t+1}$$

Momentum ($\mu \approx 0.9$) glättet Updates und beschleunigt Konvergenz entlang konsistenter Gradientenrichtungen.

## AdaGrad

AdaGrad passt die Lernrate pro Parameter auf Basis akkumulierter quadrierter Gradienten an:

$$G_t = \sum_{\tau=1}^{t} g_\tau^2$$
$$\theta_{t+1} = \theta_t - \frac{\eta}{\sqrt{G_t + \epsilon}} g_t$$

Parameter mit großen Gradienten erhalten eine kleinere effektive Lernrate. Das hilft bei spärlichen Features, etwa Word Embeddings, doch das monoton wachsende $G_t$ lässt die Lernrate langfristig fast auf null sinken.

## RMSProp

RMSProp behebt AdaGrads Zerfallsproblem durch einen exponentiell gleitenden Mittelwert:

$$G_t = \rho G_{t-1} + (1 - \rho) g_t^2$$
$$\theta_{t+1} = \theta_t - \frac{\eta}{\sqrt{G_t + \epsilon}} g_t$$

Typisch ist $\rho = 0.99$. Die effektive Lernrate stabilisiert sich, anstatt unbegrenzt zu sinken.

## Adam

Adam (Adaptive Moment Estimation) kombiniert Momentum und RMSProp:

$$m_t = \beta_1 m_{t-1} + (1 - \beta_1) g_t \quad \text{(erstes Moment)}$$
$$v_t = \beta_2 v_{t-1} + (1 - \beta_2) g_t^2 \quad \text{(zweites Moment)}$$

Da $m_0 = v_0 = 0$, sind frühe Schätzungen in Richtung null verzerrt. Die Bias-Korrektur lautet:

$$\hat{m}_t = \frac{m_t}{1 - \beta_1^t}, \quad \hat{v}_t = \frac{v_t}{1 - \beta_2^t}$$

$$\theta_{t+1} = \theta_t - \frac{\eta}{\sqrt{\hat{v}_t} + \epsilon} \hat{m}_t$$

Die Defaults $\beta_1 = 0.9$, $\beta_2 = 0.999$, $\epsilon = 10^{-8}$ funktionieren über viele Aufgaben hinweg gut.

## AdamW

Adam hat eine subtile Schwäche: L2-Regularisierung über Weight Decay interagiert unerwünscht mit adaptiven Lernraten. AdamW entkoppelt Weight Decay vom Gradientenupdate:

$$\theta_{t+1} = \theta_t - \frac{\eta}{\sqrt{\hat{v}_t} + \epsilon} \hat{m}_t - \eta \lambda \theta_t$$

Das ist die Standardwahl für das Training von Transformers und modernen LLMs.

## Verwendung in PyTorch

```python
import torch.optim as optim

# SGD with momentum
optimizer = optim.SGD(model.parameters(), lr=0.01, momentum=0.9, weight_decay=1e-4)

# Adam
optimizer = optim.Adam(model.parameters(), lr=1e-3, betas=(0.9, 0.999))

# AdamW (preferred for Transformers)
optimizer = optim.AdamW(model.parameters(), lr=3e-4, weight_decay=0.01)

# Learning rate scheduler
scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=100)
```

## Lernratenpläne

Unabhängig vom Optimierer hat der Lernratenplan großen Einfluss:

| Plan | Beschreibung | Einsatz |
|---|---|---|
| Konstant | Festes $\eta$ | Schnelle Experimente |
| Step decay | Alle $k$ Epochen mit $\gamma$ multiplizieren | ResNet-artiges Training |
| Cosine annealing | $\eta$ folgt einer Kosinuskurve | Allgemeines Deep Learning |
| Warmup + cosine | Linearer Warmup, dann Kosinus | Transformers, LLMs |
| OneCycleLR | Schneller Anstieg, langsamer Abfall | Kurze Trainingsläufe |

## Wann welchen Optimierer verwenden?

- **SGD + Momentum**: Computer Vision (ResNets, ConvNets) — erreicht mit passendem Plan oft bessere Generalisierung als Adam
- **Adam/AdamW**: NLP, Transformers und Aufgaben mit spärlichen Gradienten
- **RMSProp**: RNNs, Reinforcement Learning
- **AdaGrad**: spärliche Eingabefeatures, NLP mit Bag-of-Words-Repräsentationen

## Wichtigste Erkenntnisse

- SGD ist eine starke Baseline für Vision; Adam/AdamW dominiert im Sprachbereich
- Weight Decay von adaptiver Gradientenskalierung entkoppeln — AdamW statt Adam + L2 verwenden
- Der Lernratenplan ist oft ähnlich wichtig wie der Optimierer selbst
- Warmup verhindert Instabilität zu Beginn des Transformer-Trainings
