---
title: "Optimitzadors de gradient descendent: de SGD a Adam"
description: "Una guia pràctica dels algoritmes d'optimització més utilitzats en deep learning: què calculen, per què són diferents i quan convé utilitzar-los."
date: 2026-03-25
lang: ca
translationKey: gradient-descent-optimizers
tags: ["Deep Learning", "Optimization", "PyTorch", "Training"]
draft: false
---

## El problema central

Entrenar una xarxa neuronal significa minimitzar una funció de pèrdua $\mathcal{L}(\theta)$ sobre potencialment milers de milions de paràmetres $\theta$. El gradient descendent ho fa iterativament:

$$\theta_{t+1} = \theta_t - \eta \nabla_\theta \mathcal{L}(\theta_t)$$

on $\eta$ és el learning rate. El problema és que calcular el gradient complet sobre tot el dataset és prohibitivament costós; per això utilitzem variants **estocàstiques**.

## Gradient descendent estocàstic (SGD)

SGD calcula el gradient sobre un mini-batch aleatori de mida $B$:

$$\theta_{t+1} = \theta_t - \eta \nabla_\theta \mathcal{L}_B(\theta_t)$$

Això introdueix soroll, però aquest soroll actua com a regularitzador i ajuda a escapar de mínims estrets. Amb **momentum**, acumulem un vector de velocitat:

$$v_{t+1} = \mu v_t - \eta \nabla \mathcal{L}_B(\theta_t)$$
$$\theta_{t+1} = \theta_t + v_{t+1}$$

El momentum ($\mu \approx 0.9$) suavitza les actualitzacions i accelera la convergència en direccions de gradient consistents.

## AdaGrad

AdaGrad adapta el learning rate per paràmetre a partir dels gradients al quadrat acumulats:

$$G_t = \sum_{\tau=1}^{t} g_\tau^2$$
$$\theta_{t+1} = \theta_t - \frac{\eta}{\sqrt{G_t + \epsilon}} g_t$$

Els paràmetres que reben gradients grans obtenen un learning rate efectiu més petit. Això ajuda amb variables esparses, com embeddings de paraules, però el creixement monòton de $G_t$ fa que el learning rate acabi acostant-se a zero.

## RMSProp

RMSProp corregeix el problema de decaïment d'AdaGrad amb una mitjana mòbil exponencial:

$$G_t = \rho G_{t-1} + (1 - \rho) g_t^2$$
$$\theta_{t+1} = \theta_t - \frac{\eta}{\sqrt{G_t + \epsilon}} g_t$$

Un valor típic és $\rho = 0.99$. El learning rate efectiu s'estabilitza en lloc de disminuir indefinidament.

## Adam

Adam (Adaptive Moment Estimation) combina momentum i RMSProp:

$$m_t = \beta_1 m_{t-1} + (1 - \beta_1) g_t \quad \text{(primer moment)}$$
$$v_t = \beta_2 v_{t-1} + (1 - \beta_2) g_t^2 \quad \text{(segon moment)}$$

Com que $m_0 = v_0 = 0$, les primeres estimacions estan esbiaixades cap a zero. La correcció del biaix és:

$$\hat{m}_t = \frac{m_t}{1 - \beta_1^t}, \quad \hat{v}_t = \frac{v_t}{1 - \beta_2^t}$$

$$\theta_{t+1} = \theta_t - \frac{\eta}{\sqrt{\hat{v}_t} + \epsilon} \hat{m}_t$$

Els valors per defecte $\beta_1 = 0.9$, $\beta_2 = 0.999$, $\epsilon = 10^{-8}$ funcionen bé en una àmplia varietat de tasques.

## AdamW

Adam té una subtilesa: la regularització L2 mitjançant weight decay interactua amb els learning rates adaptatius d'una manera no desitjada. AdamW desacobla el weight decay de l'actualització del gradient:

$$\theta_{t+1} = \theta_t - \frac{\eta}{\sqrt{\hat{v}_t} + \epsilon} \hat{m}_t - \eta \lambda \theta_t$$

És l'opció estàndard per entrenar Transformers i LLM moderns.

## Ús amb PyTorch

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

## Calendaris del learning rate

Independentment de l'optimitzador, el calendari del learning rate té un impacte gran:

| Calendari | Descripció | Cas d'ús |
|---|---|---|
| Constant | $\eta$ fix | Experiments ràpids |
| Step decay | Multiplica per $\gamma$ cada $k$ èpoques | Entrenament estil ResNet |
| Cosine annealing | $\eta$ segueix una corba cosinus | Deep learning general |
| Warmup + cosine | Warmup lineal i després cosinus | Transformers, LLM |
| OneCycleLR | Pujada ràpida i baixada lenta | Entrenaments curts |

## Quan utilitzar cada opció

- **SGD + momentum**: visió per computador (ResNet, ConvNet) — sovint arriba a millor generalització que Adam amb el calendari adequat
- **Adam/AdamW**: NLP, Transformers i tasques amb gradients esparsos
- **RMSProp**: RNN i reinforcement learning
- **AdaGrad**: variables d'entrada esparses, NLP amb representacions bag-of-words

## Idees clau

- SGD és un baseline fort per a visió; Adam/AdamW domina en llenguatge
- Desacobla el weight decay de l'escalat adaptatiu del gradient: utilitza AdamW, no Adam + L2
- El calendari del learning rate sovint importa tant com l'optimitzador
- El warmup evita inestabilitat a l'inici de l'entrenament de Transformers
