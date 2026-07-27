---
title: "Diffusion Models Explained: The Math Behind Stable Diffusion"
description: "How denoising diffusion probabilistic models learn to generate images by reversing a gradual noising process — explained from the ground up."
date: 2026-05-06
tags: ["Generative AI", "Diffusion Models", "Deep Learning", "Computer Vision"]
draft: false
---

## The Core Idea

Diffusion models belong to the family of **latent variable generative models**. Their insight is elegant: instead of learning to generate data directly, learn to *denoise* it.

The training process corrupts data samples by progressively adding Gaussian noise over $T$ steps until the data is indistinguishable from pure noise. The model then learns to reverse this process — predicting and removing the noise step by step.

## The Forward Process

Given a clean data sample $x_0$, the forward process defines a Markov chain that gradually adds noise:

$$q(x_t | x_{t-1}) = \mathcal{N}(x_t;\, \sqrt{1 - \beta_t}\, x_{t-1},\, \beta_t I)$$

where $\{\beta_t\}_{t=1}^T$ is a fixed noise schedule. A useful property: we can sample $x_t$ directly from $x_0$ in closed form. Let $\alpha_t = 1 - \beta_t$ and $\bar{\alpha}_t = \prod_{s=1}^t \alpha_s$:

$$q(x_t | x_0) = \mathcal{N}(x_t;\, \sqrt{\bar{\alpha}_t}\, x_0,\, (1 - \bar{\alpha}_t) I)$$

Or equivalently via the reparameterisation trick:

$$x_t = \sqrt{\bar{\alpha}_t}\, x_0 + \sqrt{1 - \bar{\alpha}_t}\, \epsilon, \quad \epsilon \sim \mathcal{N}(0, I)$$

As $t \to T$, $\bar{\alpha}_t \to 0$ and $x_T \approx \mathcal{N}(0, I)$.

## The Reverse Process

The reverse process learns to denoise step by step:

$$p_\theta(x_{t-1} | x_t) = \mathcal{N}(x_{t-1};\, \mu_\theta(x_t, t),\, \Sigma_\theta(x_t, t))$$

The network $\epsilon_\theta(x_t, t)$ is trained to predict the noise $\epsilon$ that was added. The training objective simplifies to:

$$\mathcal{L}_{simple} = \mathbb{E}_{t, x_0, \epsilon}\left[\|\epsilon - \epsilon_\theta(x_t, t)\|^2\right]$$

This is just a denoising regression problem — predict the noise, minimise MSE.

## The Network Architecture: U-Net

The denoising network is a **U-Net** — an encoder-decoder architecture with skip connections between corresponding encoder and decoder feature maps.

```
Input x_t + timestep embedding
         ↓
  [Conv] → [ResBlock] → [Attention] → [Downsample]
         ↓                                  ↓
  [Conv] → [ResBlock] → [Attention] → [Downsample]
         ↓
      Middle Block (ResBlock + Attention)
         ↓
  [Upsample] → [ResBlock] → [Attention]
         ↓
  [Upsample] → [ResBlock] → [Attention]
         ↓
    Output (predicted noise ε)
```

The timestep $t$ is encoded as a sinusoidal embedding (similar to Transformer positional encodings) and injected into each ResBlock via FiLM conditioning.

## Noise Schedules

The schedule $\{\beta_t\}$ controls how quickly noise accumulates. Common choices:

- **Linear** (DDPM): $\beta_t$ increases linearly from $\beta_1 = 10^{-4}$ to $\beta_T = 0.02$
- **Cosine** (improved DDPM): $\bar{\alpha}_t = \cos^2\left(\frac{t/T + s}{1 + s} \cdot \frac{\pi}{2}\right)$ — avoids over-noising at early steps
- **Flow matching** (used in Stable Diffusion 3, Flux): straight paths through data-noise space for faster sampling

## DDIM: Faster Sampling

Standard DDPM requires $T = 1000$ denoising steps to generate one image. DDIM (Denoising Diffusion Implicit Models) reformulates the reverse process as a non-Markovian chain, enabling generation in 20–50 steps with comparable quality.

The DDIM update step:

$$x_{t-1} = \sqrt{\bar{\alpha}_{t-1}} \underbrace{\frac{x_t - \sqrt{1-\bar{\alpha}_t}\,\epsilon_\theta}{\sqrt{\bar{\alpha}_t}}}_{\text{predicted }x_0} + \sqrt{1 - \bar{\alpha}_{t-1}}\,\epsilon_\theta$$

## Latent Diffusion Models

Stable Diffusion operates in **latent space**, not pixel space. A variational autoencoder (VAE) first compresses the image:

$$z = \mathcal{E}(x), \quad \hat{x} = \mathcal{D}(z)$$

The diffusion process runs on the latent $z$ — typically $64 \times 64 \times 4$ for a $512 \times 512$ image. This reduces the computation by a factor of ~48× compared to pixel-space diffusion.

## Classifier-Free Guidance

To steer generation toward a text prompt $c$, classifier-free guidance interpolates between conditional and unconditional predictions:

$$\tilde{\epsilon}_\theta(x_t, t, c) = \epsilon_\theta(x_t, t, \emptyset) + w\,[\epsilon_\theta(x_t, t, c) - \epsilon_\theta(x_t, t, \emptyset)]$$

The guidance scale $w$ controls the trade-off between sample quality (higher $w$) and diversity (lower $w$). Typical values are 7–15.

## Key Takeaways

- Diffusion models frame generation as iterative denoising — a simple regression objective
- The forward process analytically defines $x_t$ from $x_0$ in one step, enabling efficient training
- DDIM reduces inference steps from 1000 to ~20–50 with no retraining
- Latent diffusion (Stable Diffusion) moves the diffusion process into a compressed VAE latent space for tractable high-resolution generation
- Classifier-free guidance is the key lever for controlling output fidelity and prompt adherence
