---
title: "Gradient Descent Optimizers: From SGD to Adam"
description: "A practical guide to the most widely used optimization algorithms in deep learning — what they compute, why they differ, and when to use each one."
date: 2026-03-25
tags: ["Deep Learning", "Optimization", "PyTorch", "Training"]
draft: false
---

## The Core Problem

Training a neural network means minimising a loss function $\mathcal{L}(\theta)$ over potentially billions of parameters $\theta$. Gradient descent does this iteratively:

$$\theta_{t+1} = \theta_t - \eta \nabla_\theta \mathcal{L}(\theta_t)$$

where $\eta$ is the learning rate. The challenge is that computing the full gradient over the entire dataset is prohibitively expensive — which is why we use **stochastic** variants.

## Stochastic Gradient Descent (SGD)

SGD computes the gradient on a random mini-batch of size $B$:

$$\theta_{t+1} = \theta_t - \eta \nabla_\theta \mathcal{L}_B(\theta_t)$$

This introduces noise, but that noise acts as a regulariser and allows escape from sharp minima. With **momentum**, we accumulate a velocity vector:

$$v_{t+1} = \mu v_t - \eta \nabla \mathcal{L}_B(\theta_t)$$
$$\theta_{t+1} = \theta_t + v_{t+1}$$

Momentum ($\mu \approx 0.9$) smooths updates and accelerates convergence along consistent gradient directions.

## AdaGrad

AdaGrad adapts the learning rate per-parameter based on the accumulated squared gradients:

$$G_t = \sum_{\tau=1}^{t} g_\tau^2$$
$$\theta_{t+1} = \theta_t - \frac{\eta}{\sqrt{G_t + \epsilon}} g_t$$

Parameters that receive large gradients get a smaller effective learning rate. This helps sparse features (e.g. word embeddings) but the monotonically increasing $G_t$ causes the learning rate to decay to near-zero.

## RMSProp

RMSProp fixes AdaGrad's decay problem with an exponential moving average:

$$G_t = \rho G_{t-1} + (1 - \rho) g_t^2$$
$$\theta_{t+1} = \theta_t - \frac{\eta}{\sqrt{G_t + \epsilon}} g_t$$

Typical $\rho = 0.99$. The effective learning rate stabilises rather than decaying indefinitely.

## Adam

Adam (Adaptive Moment Estimation) combines momentum and RMSProp:

$$m_t = \beta_1 m_{t-1} + (1 - \beta_1) g_t \quad \text{(first moment)}$$
$$v_t = \beta_2 v_{t-1} + (1 - \beta_2) g_t^2 \quad \text{(second moment)}$$

Because $m_0 = v_0 = 0$, early estimates are biased toward zero. Bias correction:

$$\hat{m}_t = \frac{m_t}{1 - \beta_1^t}, \quad \hat{v}_t = \frac{v_t}{1 - \beta_2^t}$$

$$\theta_{t+1} = \theta_t - \frac{\eta}{\sqrt{\hat{v}_t} + \epsilon} \hat{m}_t$$

Defaults $\beta_1 = 0.9$, $\beta_2 = 0.999$, $\epsilon = 10^{-8}$ work well across a broad range of tasks.

## AdamW

Adam has a subtle flaw: L2 regularisation via weight decay interacts with the adaptive learning rates in an unintended way. AdamW decouples weight decay from the gradient update:

$$\theta_{t+1} = \theta_t - \frac{\eta}{\sqrt{\hat{v}_t} + \epsilon} \hat{m}_t - \eta \lambda \theta_t$$

This is the standard choice for training Transformers and modern LLMs.

## PyTorch Usage

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

## Learning Rate Schedules

No matter the optimizer, the learning rate schedule has a large impact:

| Schedule | Description | Use Case |
|---|---|---|
| Constant | Fixed $\eta$ | Quick experiments |
| Step decay | Multiply by $\gamma$ every $k$ epochs | ResNet-style training |
| Cosine annealing | $\eta$ follows a cosine curve | General deep learning |
| Warmup + cosine | Linear warmup then cosine | Transformers, LLMs |
| OneCycleLR | Fast ramp up, slow ramp down | Short training runs |

## When to Use What

- **SGD + momentum**: Computer vision (ResNets, ConvNets) — often reaches better generalisation than Adam with the right schedule
- **Adam/AdamW**: NLP, Transformers, any task with sparse gradients
- **RMSProp**: RNNs, reinforcement learning
- **AdaGrad**: Sparse input features, NLP with bag-of-words representations

## Key Takeaways

- SGD is a strong baseline for vision; Adam/AdamW dominates for language
- Decouple weight decay from adaptive gradient scaling — use AdamW, not Adam + L2
- The learning rate schedule often matters as much as the optimizer itself
- Warmup prevents instability at the start of Transformer training
