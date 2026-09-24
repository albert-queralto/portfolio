---
title: "Optimizadores de descenso de gradiente: de SGD a Adam"
description: "Una guía práctica de los algoritmos de optimización más utilizados en deep learning: qué calculan, por qué difieren y cuándo usar cada uno."
date: 2026-03-25
lang: es
translationKey: gradient-descent-optimizers
tags: ["Deep Learning", "Optimization", "PyTorch", "Training"]
draft: false
---

## El problema central

Entrenar una red neuronal significa minimizar una función de pérdida $\mathcal{L}(\theta)$ sobre potencialmente miles de millones de parámetros $\theta$. El descenso de gradiente lo hace iterativamente:

$$\theta_{t+1} = \theta_t - \eta \nabla_\theta \mathcal{L}(\theta_t)$$

donde $\eta$ es el learning rate. El problema es que calcular el gradiente completo sobre todo el dataset resulta prohibitivamente costoso, por lo que utilizamos variantes **estocásticas**.

## Descenso de gradiente estocástico (SGD)

SGD calcula el gradiente sobre un mini-batch aleatorio de tamaño $B$:

$$\theta_{t+1} = \theta_t - \eta \nabla_\theta \mathcal{L}_B(\theta_t)$$

Esto introduce ruido, pero ese ruido actúa como regularizador y ayuda a escapar de mínimos estrechos. Con **momentum**, acumulamos un vector de velocidad:

$$v_{t+1} = \mu v_t - \eta \nabla \mathcal{L}_B(\theta_t)$$
$$\theta_{t+1} = \theta_t + v_{t+1}$$

El momentum ($\mu \approx 0.9$) suaviza las actualizaciones y acelera la convergencia en direcciones de gradiente consistentes.

## AdaGrad

AdaGrad adapta el learning rate por parámetro según los gradientes al cuadrado acumulados:

$$G_t = \sum_{\tau=1}^{t} g_\tau^2$$
$$\theta_{t+1} = \theta_t - \frac{\eta}{\sqrt{G_t + \epsilon}} g_t$$

Los parámetros que reciben gradientes grandes obtienen un learning rate efectivo menor. Esto ayuda con variables dispersas, como embeddings de palabras, pero el crecimiento monótono de $G_t$ hace que el learning rate termine decayendo casi hasta cero.

## RMSProp

RMSProp corrige el problema de decaimiento de AdaGrad con una media móvil exponencial:

$$G_t = \rho G_{t-1} + (1 - \rho) g_t^2$$
$$\theta_{t+1} = \theta_t - \frac{\eta}{\sqrt{G_t + \epsilon}} g_t$$

Un valor típico es $\rho = 0.99$. El learning rate efectivo se estabiliza en lugar de decaer indefinidamente.

## Adam

Adam (Adaptive Moment Estimation) combina momentum y RMSProp:

$$m_t = \beta_1 m_{t-1} + (1 - \beta_1) g_t \quad \text{(primer momento)}$$
$$v_t = \beta_2 v_{t-1} + (1 - \beta_2) g_t^2 \quad \text{(segundo momento)}$$

Como $m_0 = v_0 = 0$, las primeras estimaciones están sesgadas hacia cero. La corrección del sesgo es:

$$\hat{m}_t = \frac{m_t}{1 - \beta_1^t}, \quad \hat{v}_t = \frac{v_t}{1 - \beta_2^t}$$

$$\theta_{t+1} = \theta_t - \frac{\eta}{\sqrt{\hat{v}_t} + \epsilon} \hat{m}_t$$

Los valores por defecto $\beta_1 = 0.9$, $\beta_2 = 0.999$, $\epsilon = 10^{-8}$ funcionan bien en una amplia variedad de tareas.

## AdamW

Adam tiene una sutileza: la regularización L2 mediante weight decay interactúa con los learning rates adaptativos de una forma no deseada. AdamW desacopla el weight decay de la actualización del gradiente:

$$\theta_{t+1} = \theta_t - \frac{\eta}{\sqrt{\hat{v}_t} + \epsilon} \hat{m}_t - \eta \lambda \theta_t$$

Es la opción estándar para entrenar Transformers y LLM modernos.

## Uso con PyTorch

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

## Calendarios del learning rate

Independientemente del optimizador, el calendario del learning rate tiene un gran impacto:

| Calendario | Descripción | Caso de uso |
|---|---|---|
| Constante | $\eta$ fijo | Experimentos rápidos |
| Step decay | Multiplica por $\gamma$ cada $k$ épocas | Entrenamiento estilo ResNet |
| Cosine annealing | $\eta$ sigue una curva coseno | Deep learning general |
| Warmup + cosine | Warmup lineal y después coseno | Transformers, LLM |
| OneCycleLR | Subida rápida y bajada lenta | Entrenamientos cortos |

## Cuándo utilizar cada opción

- **SGD + momentum**: visión por computador (ResNet, ConvNet) — a menudo alcanza mejor generalización que Adam con el calendario adecuado
- **Adam/AdamW**: NLP, Transformers y cualquier tarea con gradientes dispersos
- **RMSProp**: RNN y reinforcement learning
- **AdaGrad**: variables de entrada dispersas, NLP con representaciones bag-of-words

## Ideas clave

- SGD es un baseline fuerte para visión; Adam/AdamW domina en lenguaje
- Desacopla el weight decay del escalado adaptativo del gradiente: usa AdamW, no Adam + L2
- El calendario del learning rate suele importar tanto como el optimizador
- El warmup evita inestabilidad al inicio del entrenamiento de Transformers
