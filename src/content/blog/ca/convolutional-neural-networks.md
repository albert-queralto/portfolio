---
title: "Xarxes neuronals convolucionals: com veuen les màquines"
description: "Una explicació des de zero de les CNN: convolució, pooling, camps receptius i les decisions arquitectòniques que van fer funcionar el deep learning per a imatges."
date: 2026-04-08
lang: ca
translationKey: convolutional-neural-networks
tags: ["Computer Vision", "CNN", "Deep Learning", "PyTorch"]
draft: false
---

## Per què no utilitzar simplement MLP?

Una imatge RGB de 224×224 té $224 \times 224 \times 3 = 150{,}528$ valors d'entrada. Una capa oculta completament connectada amb 1.000 unitats necessitaria uns 150 milions de paràmetres només per a la primera capa. Això és computacionalment costós, estadísticament ineficient i ignora l'estructura espacial de les imatges.

Les CNN exploten tres biaixos inductius clau:
1. **Connectivitat local** — els píxels propers solen estar més relacionats que els llunyans
2. **Compartició de pesos** — el mateix detector de característiques és útil a qualsevol punt de la imatge
3. **Equivariància a translacions** — un gat continua sent un gat independentment d'on aparegui

## L'operació de convolució

Una capa convolucional aplica un filtre après $W$ de mida $k \times k$, desplaçant-lo sobre l'entrada i calculant productes escalars:

$$(X * W)[i, j] = \sum_{m=0}^{k-1} \sum_{n=0}^{k-1} X[i+m,\, j+n] \cdot W[m, n]$$

Per a una entrada de mida $H \times W$ i un filtre de mida $k \times k$ amb stride $s$ i padding $p$, la mida espacial de la sortida és:

$$H_{out} = \left\lfloor \frac{H + 2p - k}{s} \right\rfloor + 1$$

Una capa amb $C_{out}$ filtres aprèn $C_{out}$ mapes de característiques diferents, cadascun detectant un patró diferent (vores, textures o formes).

## Pooling

El pooling redueix les dimensions espacials i construeix invariància a translacions. El max pooling pren el valor màxim d'una regió local:

$$y[i, j] = \max_{(m,n) \in \mathcal{R}_{ij}} x[m, n]$$

Un max pool de $2 \times 2$ amb stride 2 redueix a la meitat l'altura i l'amplada. L'average pooling s'utilitza en capes posteriors o per a agregació global (`AdaptiveAvgPool2d`).

## Camp receptiu

El camp receptiu d'una neurona és la regió de l'entrada que afecta la seva activació. Amb $L$ capes de convolucions $k \times k$ i stride 1:

$$RF = 1 + L(k - 1)$$

Apilar filtres petits de $3 \times 3$ és més eficient en paràmetres que utilitzar filtres grans, mantenint el mateix camp receptiu. Dues capes de $3 \times 3$ cobreixen una regió de $5 \times 5$ amb menys paràmetres i una no-linealitat addicional.

## Arquitectures clàssiques

### LeNet-5 (1998)
La primera CNN pràctica. Dues capes convolucionals + pooling seguides de capes completament connectades. Dissenyada per a imatges de dígits en escala de grisos de 32×32.

### AlexNet (2012)
Va guanyar ImageNet amb un marge ampli. Innovacions clau: activacions ReLU, dropout, augment de dades i entrenament amb GPU. Utilitzava filtres de $11 \times 11$ i $5 \times 5$ a les primeres capes.

### VGG (2014)
Va demostrar que la profunditat importa. Utilitza exclusivament filtres convolucionals de $3 \times 3$ apilats fins a 16–19 capes. Simple i molt influent; encara s'utilitza com a backbone.

### ResNet (2015)
Va introduir les **connexions residuals** per permetre entrenar xarxes molt profundes (50–152 capes):

$$\text{output} = \mathcal{F}(x) + x$$

La skip connection ajuda a resoldre el problema del gradient evanescent proporcionant una via directa per al gradient. ResNet50 continua sent un baseline estàndard.

### Modernes: EfficientNet, ConvNeXt
EfficientNet utilitza cerca d'arquitectures neuronals per escalar conjuntament profunditat, amplada i resolució. ConvNeXt revisita dissenys purament convolucionals incorporant idees inspirades en Transformers (layer norm, kernels més grans, GELU).

## Un bloc ResNet en PyTorch

```python
import torch
import torch.nn as nn

class ResidualBlock(nn.Module):
    def __init__(self, channels: int):
        super().__init__()
        self.block = nn.Sequential(
            nn.Conv2d(channels, channels, 3, padding=1, bias=False),
            nn.BatchNorm2d(channels),
            nn.ReLU(inplace=True),
            nn.Conv2d(channels, channels, 3, padding=1, bias=False),
            nn.BatchNorm2d(channels),
        )
        self.relu = nn.ReLU(inplace=True)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.relu(self.block(x) + x)
```

## Normalització per batch

BatchNorm normalitza l'entrada de cada capa a mitjana zero i variància unitària sobre el mini-batch, i després aplica una escala apresa $\gamma$ i un desplaçament $\beta$:

$$\hat{x} = \frac{x - \mu_B}{\sqrt{\sigma_B^2 + \epsilon}}, \quad y = \gamma \hat{x} + \beta$$

Això estabilitza l'entrenament, permet learning rates més alts i actua com un regularitzador suau. Se situa abans o després de la funció d'activació; abans és més habitual en xarxes modernes.

## Transfer learning

Les característiques de CNN preentrenades es transfereixen sorprenentment bé entre tasques. El flux habitual és:

```python
import torchvision.models as models

# Load pre-trained weights
backbone = models.resnet50(weights=models.ResNet50_Weights.IMAGENET1K_V2)

# Replace the classifier head
num_classes = 10
backbone.fc = nn.Linear(backbone.fc.in_features, num_classes)

# Fine-tune: freeze early layers, train later ones
for name, param in backbone.named_parameters():
    if "layer4" not in name and "fc" not in name:
        param.requires_grad = False
```

## Idees clau

- La convolució explota l'estructura espacial local amb molts menys paràmetres que les capes completament connectades
- Les connexions residuals són una de les innovacions arquitectòniques més impactants per a CNN profundes
- Convolucions de $3 \times 3$ + profunditat superen filtres únics de gran mida
- BatchNorm gairebé sempre és beneficiosa en xarxes convolucionals profundes
- El transfer learning a partir de preentrenament amb ImageNet proporciona inicialitzacions fortes per a la majoria de tasques de visió
