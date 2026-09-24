---
title: "Diffusionsmodelle erklärt: die Mathematik hinter Stable Diffusion"
description: "Wie denoising-basierte probabilistische Diffusionsmodelle Bilder erzeugen, indem sie einen schrittweisen Verrauschungsprozess umkehren – von Grund auf erklärt."
date: 2026-05-06
lang: de
translationKey: diffusion-models
tags: ["Generative AI", "Diffusion Models", "Deep Learning", "Computer Vision"]
draft: false
---

## Die Grundidee

Diffusionsmodelle gehören zur Familie der **generativen Modelle mit latenten Variablen**. Ihre Idee ist elegant: Statt Daten direkt zu erzeugen, lernt das Modell, sie zu *entrauschen*.

Im Training werden Datenbeispiele über $T$ Schritte schrittweise mit gaußschem Rauschen verfälscht, bis sie praktisch nicht mehr von reinem Rauschen zu unterscheiden sind. Anschließend lernt das Modell, diesen Prozess umzukehren und das Rauschen Schritt für Schritt vorherzusagen und zu entfernen.

## Der Vorwärtsprozess

Ausgehend von einer sauberen Probe $x_0$ definiert der Vorwärtsprozess eine Markov-Kette, die nach und nach Rauschen hinzufügt:

$$q(x_t | x_{t-1}) = \mathcal{N}(x_t;\, \sqrt{1 - \beta_t}\, x_{t-1},\, \beta_t I)$$

wobei $\{\beta_t\}_{t=1}^T$ ein fester Rauschplan ist. Eine nützliche Eigenschaft: $x_t$ kann direkt aus $x_0$ in geschlossener Form gesampelt werden. Setzen wir $\alpha_t = 1 - \beta_t$ und $\bar{\alpha}_t = \prod_{s=1}^t \alpha_s$:

$$q(x_t | x_0) = \mathcal{N}(x_t;\, \sqrt{\bar{\alpha}_t}\, x_0,\, (1 - \bar{\alpha}_t) I)$$

Oder äquivalent über den Reparametrisierungstrick:

$$x_t = \sqrt{\bar{\alpha}_t}\, x_0 + \sqrt{1 - \bar{\alpha}_t}\, \epsilon, \quad \epsilon \sim \mathcal{N}(0, I)$$

Für $t \to T$ gilt $\bar{\alpha}_t \to 0$ und $x_T \approx \mathcal{N}(0, I)$.

## Der Rückwärtsprozess

Der Rückwärtsprozess lernt, Schritt für Schritt zu entrauschen:

$$p_\theta(x_{t-1} | x_t) = \mathcal{N}(x_{t-1};\, \mu_\theta(x_t, t),\, \Sigma_\theta(x_t, t))$$

Das Netz $\epsilon_\theta(x_t, t)$ wird darauf trainiert, das hinzugefügte Rauschen $\epsilon$ vorherzusagen. Das Trainingsziel vereinfacht sich zu:

$$\mathcal{L}_{simple} = \mathbb{E}_{t, x_0, \epsilon}\left[\|\epsilon - \epsilon_\theta(x_t, t)\|^2\right]$$

Damit wird das Problem zu einer Denoising-Regression: Rauschen vorhersagen und den MSE minimieren.

## Die Netzarchitektur: U-Net

Das Denoising-Netz ist ein **U-Net**, also eine Encoder-Decoder-Architektur mit Skip Connections zwischen korrespondierenden Feature Maps von Encoder und Decoder.

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

Der Zeitschritt $t$ wird als sinusförmiges Embedding kodiert, ähnlich den Positionskodierungen von Transformers, und per FiLM-Conditioning in jeden ResBlock eingespeist.

## Rauschpläne

Der Plan $\{\beta_t\}$ steuert, wie schnell sich Rauschen ansammelt. Häufige Varianten:

- **Linear** (DDPM): $\beta_t$ steigt linear von $\beta_1 = 10^{-4}$ auf $\beta_T = 0.02$
- **Kosinus** (verbessertes DDPM): $\bar{\alpha}_t = \cos^2\left(\frac{t/T + s}{1 + s} \cdot \frac{\pi}{2}\right)$ — verhindert zu starke Verrauschung in frühen Schritten
- **Flow Matching** (u. a. Stable Diffusion 3, Flux): gerade Pfade durch den Daten-Rausch-Raum für schnelleres Sampling

## DDIM: schnelleres Sampling

Ein Standard-DDPM benötigt $T = 1000$ Denoising-Schritte für ein Bild. DDIM (Denoising Diffusion Implicit Models) formuliert den Rückwärtsprozess als nicht-markovsche Kette und ermöglicht dadurch Generierung in 20–50 Schritten bei vergleichbarer Qualität.

Der DDIM-Aktualisierungsschritt:

$$x_{t-1} = \sqrt{\bar{\alpha}_{t-1}} \underbrace{\frac{x_t - \sqrt{1-\bar{\alpha}_t}\,\epsilon_\theta}{\sqrt{\bar{\alpha}_t}}}_{\text{vorhergesagtes }x_0} + \sqrt{1 - \bar{\alpha}_{t-1}}\,\epsilon_\theta$$

## Latente Diffusionsmodelle

Stable Diffusion arbeitet im **latenten Raum**, nicht direkt im Pixelraum. Ein Variational Autoencoder (VAE) komprimiert zunächst das Bild:

$$z = \mathcal{E}(x), \quad \hat{x} = \mathcal{D}(z)$$

Der Diffusionsprozess läuft auf dem latenten $z$, typischerweise $64 \times 64 \times 4$ für ein $512 \times 512$-Bild. Das reduziert den Rechenaufwand gegenüber Pixelraum-Diffusion ungefähr um den Faktor 48.

## Classifier-Free Guidance

Um die Generierung in Richtung eines Textprompts $c$ zu lenken, interpoliert Classifier-Free Guidance zwischen bedingten und unbedingten Vorhersagen:

$$\tilde{\epsilon}_\theta(x_t, t, c) = \epsilon_\theta(x_t, t, \emptyset) + w\,[\epsilon_\theta(x_t, t, c) - \epsilon_\theta(x_t, t, \emptyset)]$$

Die Guidance-Skala $w$ steuert den Kompromiss zwischen Sample-Qualität (höheres $w$) und Vielfalt (niedrigeres $w$). Typische Werte liegen bei 7–15.

## Wichtigste Erkenntnisse

- Diffusionsmodelle formulieren Generierung als iteratives Denoising mit einem einfachen Regressionsziel
- Der Vorwärtsprozess definiert $x_t$ analytisch aus $x_0$ in einem Schritt und macht das Training dadurch effizient
- DDIM reduziert die Inferenz von 1000 auf etwa 20–50 Schritte ohne Retraining
- Latente Diffusion verschiebt den Prozess in einen komprimierten VAE-Latentraum und macht hochauflösende Generierung praktikabel
- Classifier-Free Guidance ist der wichtigste Hebel für Ausgabetreue und Prompt-Adhärenz
