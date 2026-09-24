---
title: "Models de difusió explicats: les matemàtiques darrere de Stable Diffusion"
description: "Com els models probabilístics de difusió amb denoising aprenen a generar imatges invertint un procés gradual d'addició de soroll, explicat des de zero."
date: 2026-05-06
lang: ca
translationKey: diffusion-models
tags: ["Generative AI", "Diffusion Models", "Deep Learning", "Computer Vision"]
draft: false
---

## La idea central

Els models de difusió formen part de la família dels **models generatius amb variables latents**. La seva idea és elegant: en lloc d'aprendre a generar dades directament, aprenen a *eliminar-ne el soroll*.

Durant l'entrenament, les mostres de dades es corrompen afegint soroll gaussià progressivament al llarg de $T$ passos fins que les dades són pràcticament indistingibles de soroll pur. El model aprèn després a invertir aquest procés, predient i eliminant el soroll pas a pas.

## El procés directe

Donada una mostra neta $x_0$, el procés directe defineix una cadena de Markov que afegeix soroll gradualment:

$$q(x_t | x_{t-1}) = \mathcal{N}(x_t;\, \sqrt{1 - \beta_t}\, x_{t-1},\, \beta_t I)$$

on $\{\beta_t\}_{t=1}^T$ és un calendari de soroll fix. Una propietat útil és que podem mostrejar $x_t$ directament a partir de $x_0$ en forma tancada. Definim $\alpha_t = 1 - \beta_t$ i $\bar{\alpha}_t = \prod_{s=1}^t \alpha_s$:

$$q(x_t | x_0) = \mathcal{N}(x_t;\, \sqrt{\bar{\alpha}_t}\, x_0,\, (1 - \bar{\alpha}_t) I)$$

O, de manera equivalent, amb el truc de reparametrització:

$$x_t = \sqrt{\bar{\alpha}_t}\, x_0 + \sqrt{1 - \bar{\alpha}_t}\, \epsilon, \quad \epsilon \sim \mathcal{N}(0, I)$$

Quan $t \to T$, $\bar{\alpha}_t \to 0$ i $x_T \approx \mathcal{N}(0, I)$.

## El procés invers

El procés invers aprèn a eliminar el soroll pas a pas:

$$p_\theta(x_{t-1} | x_t) = \mathcal{N}(x_{t-1};\, \mu_\theta(x_t, t),\, \Sigma_\theta(x_t, t))$$

La xarxa $\epsilon_\theta(x_t, t)$ s'entrena per predir el soroll $\epsilon$ que s'havia afegit. La funció objectiu d'entrenament se simplifica a:

$$\mathcal{L}_{simple} = \mathbb{E}_{t, x_0, \epsilon}\left[\|\epsilon - \epsilon_\theta(x_t, t)\|^2\right]$$

Això és simplement un problema de regressió de denoising: predir el soroll i minimitzar l'MSE.

## L'arquitectura de xarxa: U-Net

La xarxa de denoising és una **U-Net**, una arquitectura encoder-decoder amb skip connections entre mapes de característiques corresponents de l'encoder i el decoder.

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

El timestep $t$ es codifica com un embedding sinusoidal, similar a les codificacions posicionals dels Transformers, i s'injecta a cada ResBlock mitjançant condicionament FiLM.

## Calendaris de soroll

El calendari $\{\beta_t\}$ controla amb quina rapidesa s'acumula el soroll. Algunes opcions habituals són:

- **Lineal** (DDPM): $\beta_t$ creix linealment de $\beta_1 = 10^{-4}$ fins a $\beta_T = 0.02$
- **Cosinus** (DDPM millorat): $\bar{\alpha}_t = \cos^2\left(\frac{t/T + s}{1 + s} \cdot \frac{\pi}{2}\right)$ — evita afegir massa soroll als primers passos
- **Flow matching** (utilitzat a Stable Diffusion 3 i Flux): trajectòries rectes a través de l'espai dades-soroll per accelerar el mostreig

## DDIM: mostreig més ràpid

El DDPM estàndard necessita $T = 1000$ passos de denoising per generar una sola imatge. DDIM (Denoising Diffusion Implicit Models) reformula el procés invers com una cadena no markoviana, cosa que permet generar en 20–50 passos amb una qualitat comparable.

El pas d'actualització DDIM és:

$$x_{t-1} = \sqrt{\bar{\alpha}_{t-1}} \underbrace{\frac{x_t - \sqrt{1-\bar{\alpha}_t}\,\epsilon_\theta}{\sqrt{\bar{\alpha}_t}}}_{\text{$x_0$ predit}} + \sqrt{1 - \bar{\alpha}_{t-1}}\,\epsilon_\theta$$

## Models de difusió latent

Stable Diffusion treballa en **espai latent**, no en espai de píxels. Primer, un autoencoder variacional (VAE) comprimeix la imatge:

$$z = \mathcal{E}(x), \quad \hat{x} = \mathcal{D}(z)$$

El procés de difusió s'executa sobre el latent $z$, habitualment de $64 \times 64 \times 4$ per a una imatge de $512 \times 512$. Això redueix el cost computacional aproximadament 48× respecte de la difusió en espai de píxels.

## Classifier-Free Guidance

Per guiar la generació cap a un prompt de text $c$, classifier-free guidance interpola entre prediccions condicionals i incondicionals:

$$\tilde{\epsilon}_\theta(x_t, t, c) = \epsilon_\theta(x_t, t, \emptyset) + w\,[\epsilon_\theta(x_t, t, c) - \epsilon_\theta(x_t, t, \emptyset)]$$

L'escala de guidance $w$ controla el compromís entre qualitat de la mostra (valors més alts de $w$) i diversitat (valors més baixos). Valors típics són 7–15.

## Idees clau

- Els models de difusió formulen la generació com un procés iteratiu de denoising amb una funció objectiu de regressió simple
- El procés directe defineix analíticament $x_t$ a partir de $x_0$ en un sol pas, cosa que fa eficient l'entrenament
- DDIM redueix els passos d'inferència de 1000 a aproximadament 20–50 sense reentrenar
- La difusió latent de Stable Diffusion trasllada el procés a un espai latent comprimit d'un VAE per fer viable la generació d'alta resolució
- Classifier-free guidance és el principal control sobre la fidelitat de la sortida i l'adhesió al prompt
