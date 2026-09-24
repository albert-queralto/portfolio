---
title: "Modelos de difusión explicados: las matemáticas detrás de Stable Diffusion"
description: "Cómo los modelos probabilísticos de difusión con denoising aprenden a generar imágenes invirtiendo un proceso gradual de adición de ruido, explicado desde cero."
date: 2026-05-06
lang: es
translationKey: diffusion-models
tags: ["Generative AI", "Diffusion Models", "Deep Learning", "Computer Vision"]
draft: false
---

## La idea central

Los modelos de difusión pertenecen a la familia de **modelos generativos con variables latentes**. Su idea es elegante: en lugar de aprender a generar datos directamente, aprenden a *eliminarles el ruido*.

Durante el entrenamiento, las muestras se corrompen añadiendo progresivamente ruido gaussiano a lo largo de $T$ pasos hasta que los datos son prácticamente indistinguibles de ruido puro. Después, el modelo aprende a invertir ese proceso, prediciendo y eliminando el ruido paso a paso.

## El proceso directo

Dada una muestra limpia $x_0$, el proceso directo define una cadena de Markov que añade ruido gradualmente:

$$q(x_t | x_{t-1}) = \mathcal{N}(x_t;\, \sqrt{1 - \beta_t}\, x_{t-1},\, \beta_t I)$$

donde $\{\beta_t\}_{t=1}^T$ es un calendario de ruido fijo. Una propiedad útil es que podemos muestrear $x_t$ directamente a partir de $x_0$ en forma cerrada. Definimos $\alpha_t = 1 - \beta_t$ y $\bar{\alpha}_t = \prod_{s=1}^t \alpha_s$:

$$q(x_t | x_0) = \mathcal{N}(x_t;\, \sqrt{\bar{\alpha}_t}\, x_0,\, (1 - \bar{\alpha}_t) I)$$

O, de forma equivalente, mediante el truco de reparametrización:

$$x_t = \sqrt{\bar{\alpha}_t}\, x_0 + \sqrt{1 - \bar{\alpha}_t}\, \epsilon, \quad \epsilon \sim \mathcal{N}(0, I)$$

Cuando $t \to T$, $\bar{\alpha}_t \to 0$ y $x_T \approx \mathcal{N}(0, I)$.

## El proceso inverso

El proceso inverso aprende a eliminar el ruido paso a paso:

$$p_\theta(x_{t-1} | x_t) = \mathcal{N}(x_{t-1};\, \mu_\theta(x_t, t),\, \Sigma_\theta(x_t, t))$$

La red $\epsilon_\theta(x_t, t)$ se entrena para predecir el ruido $\epsilon$ añadido. El objetivo de entrenamiento se simplifica a:

$$\mathcal{L}_{simple} = \mathbb{E}_{t, x_0, \epsilon}\left[\|\epsilon - \epsilon_\theta(x_t, t)\|^2\right]$$

Esto es simplemente un problema de regresión de denoising: predecir el ruido y minimizar el MSE.

## La arquitectura de red: U-Net

La red de denoising es una **U-Net**, una arquitectura encoder-decoder con skip connections entre mapas de características correspondientes del encoder y el decoder.

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

El timestep $t$ se codifica como un embedding sinusoidal, similar a las codificaciones posicionales de los Transformers, y se inyecta en cada ResBlock mediante condicionamiento FiLM.

## Calendarios de ruido

El calendario $\{\beta_t\}$ controla la rapidez con la que se acumula el ruido. Opciones habituales:

- **Lineal** (DDPM): $\beta_t$ aumenta linealmente desde $\beta_1 = 10^{-4}$ hasta $\beta_T = 0.02$
- **Coseno** (DDPM mejorado): $\bar{\alpha}_t = \cos^2\left(\frac{t/T + s}{1 + s} \cdot \frac{\pi}{2}\right)$ — evita añadir demasiado ruido en los primeros pasos
- **Flow matching** (utilizado en Stable Diffusion 3 y Flux): trayectorias rectas a través del espacio datos-ruido para acelerar el muestreo

## DDIM: muestreo más rápido

El DDPM estándar requiere $T = 1000$ pasos de denoising para generar una imagen. DDIM (Denoising Diffusion Implicit Models) reformula el proceso inverso como una cadena no markoviana, permitiendo generar en 20–50 pasos con calidad comparable.

El paso de actualización DDIM es:

$$x_{t-1} = \sqrt{\bar{\alpha}_{t-1}} \underbrace{\frac{x_t - \sqrt{1-\bar{\alpha}_t}\,\epsilon_\theta}{\sqrt{\bar{\alpha}_t}}}_{\text{$x_0$ predicho}} + \sqrt{1 - \bar{\alpha}_{t-1}}\,\epsilon_\theta$$

## Modelos de difusión latente

Stable Diffusion opera en **espacio latente**, no en espacio de píxeles. Primero, un autoencoder variacional (VAE) comprime la imagen:

$$z = \mathcal{E}(x), \quad \hat{x} = \mathcal{D}(z)$$

El proceso de difusión se ejecuta sobre el latente $z$, normalmente de $64 \times 64 \times 4$ para una imagen de $512 \times 512$. Esto reduce el coste computacional aproximadamente 48× frente a la difusión en espacio de píxeles.

## Classifier-Free Guidance

Para orientar la generación hacia un prompt de texto $c$, classifier-free guidance interpola entre predicciones condicionales e incondicionales:

$$\tilde{\epsilon}_\theta(x_t, t, c) = \epsilon_\theta(x_t, t, \emptyset) + w\,[\epsilon_\theta(x_t, t, c) - \epsilon_\theta(x_t, t, \emptyset)]$$

La escala de guidance $w$ controla el compromiso entre calidad de la muestra (mayor $w$) y diversidad (menor $w$). Los valores habituales son 7–15.

## Ideas clave

- Los modelos de difusión plantean la generación como denoising iterativo con un objetivo de regresión sencillo
- El proceso directo define analíticamente $x_t$ a partir de $x_0$ en un solo paso, haciendo eficiente el entrenamiento
- DDIM reduce los pasos de inferencia de 1000 a aproximadamente 20–50 sin reentrenamiento
- La difusión latente de Stable Diffusion mueve el proceso a un espacio latente comprimido de un VAE para hacer viable la generación de alta resolución
- Classifier-free guidance es el principal control de fidelidad de salida y adherencia al prompt
