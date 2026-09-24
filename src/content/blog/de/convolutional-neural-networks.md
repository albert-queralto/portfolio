---
title: "Convolutional Neural Networks: wie Maschinen sehen"
description: "Eine grundlegende Erklärung von CNNs – Faltung, Pooling, rezeptive Felder und die Architekturentscheidungen, die Deep Learning für Bilder erfolgreich machten."
date: 2026-04-08
lang: de
translationKey: convolutional-neural-networks
tags: ["Computer Vision", "CNN", "Deep Learning", "PyTorch"]
draft: false
---

## Warum nicht einfach MLPs verwenden?

Ein 224×224-RGB-Bild besitzt $224 \times 224 \times 3 = 150{,}528$ Eingabewerte. Eine vollverbundene Hidden Layer mit 1.000 Einheiten würde ungefähr 150 Millionen Parameter benötigen — allein für die erste Schicht. Das ist rechnerisch teuer, statistisch ineffizient und ignoriert die räumliche Struktur von Bildern.

CNNs nutzen drei wichtige induktive Biases:
1. **Lokale Konnektivität** — benachbarte Pixel hängen stärker zusammen als weit entfernte
2. **Weight Sharing** — derselbe Feature-Detektor ist überall im Bild nützlich
3. **Translationsäquivarianz** — eine Katze bleibt eine Katze, unabhängig davon, wo sie erscheint

## Die Faltungsoperation

Eine Faltungsschicht wendet einen gelernten Filter $W$ der Größe $k \times k$ an, indem sie ihn über die Eingabe schiebt und Skalarprodukte berechnet:

$$(X * W)[i, j] = \sum_{m=0}^{k-1} \sum_{n=0}^{k-1} X[i+m,\, j+n] \cdot W[m, n]$$

Für eine Eingabe der Größe $H \times W$ und einen Filter $k \times k$ mit Stride $s$ und Padding $p$ ist die räumliche Ausgabegröße:

$$H_{out} = \left\lfloor \frac{H + 2p - k}{s} \right\rfloor + 1$$

Eine Schicht mit $C_{out}$ Filtern lernt $C_{out}$ unterschiedliche Feature Maps, die jeweils verschiedene Muster erkennen (Kanten, Texturen, Formen).

## Pooling

Pooling reduziert räumliche Dimensionen und erzeugt Translationsinvarianz. Max Pooling nimmt den maximalen Wert innerhalb einer lokalen Region:

$$y[i, j] = \max_{(m,n) \in \mathcal{R}_{ij}} x[m, n]$$

Ein $2 \times 2$ Max Pool mit Stride 2 halbiert Höhe und Breite. Average Pooling wird in späteren Schichten oder für globale Aggregation (`AdaptiveAvgPool2d`) verwendet.

## Rezeptives Feld

Das rezeptive Feld eines Neurons ist der Bereich der Eingabe, der seine Aktivierung beeinflusst. Mit $L$ Schichten von $k \times k$-Faltungen und Stride 1 gilt:

$$RF = 1 + L(k - 1)$$

Kleine $3 \times 3$-Filter zu stapeln ist parametereffizienter als große Filter und erreicht dasselbe rezeptive Feld. Zwei $3 \times 3$-Schichten decken einen $5 \times 5$-Bereich mit weniger Parametern und einer zusätzlichen Nichtlinearität ab.

## Klassische Architekturen

### LeNet-5 (1998)
Das erste praktische CNN. Zwei Conv-Layer + Pooling, gefolgt von vollverbundenen Schichten. Für 32×32-Graustufenbilder von Ziffern entwickelt.

### AlexNet (2012)
Gewann ImageNet mit großem Abstand. Zentrale Innovationen: ReLU-Aktivierungen, Dropout, Data Augmentation und GPU-Training. Verwendete $11 \times 11$- und $5 \times 5$-Filter in frühen Schichten.

### VGG (2014)
Zeigte, dass Tiefe entscheidend ist. Verwendete ausschließlich gestapelte $3 \times 3$-Faltungen in 16–19 Schichten. Einfach und äußerst einflussreich; noch heute als Backbone gebräuchlich.

### ResNet (2015)
Führte **Residualverbindungen** ein, um sehr tiefe Netze (50–152 Schichten) trainieren zu können:

$$\text{output} = \mathcal{F}(x) + x$$

Die Skip Connection hilft gegen verschwindende Gradienten, indem sie einen direkten Gradientenpfad bereitstellt. ResNet50 bleibt eine Standard-Baseline.

### Moderne Ansätze: EfficientNet, ConvNeXt
EfficientNet nutzt Neural Architecture Search, um Tiefe, Breite und Auflösung gemeinsam zu skalieren. ConvNeXt greift reine Faltungsdesigns mit Transformer-inspirierten Anpassungen wieder auf (Layer Norm, größere Kernel, GELU).

## Ein ResNet-Block in PyTorch

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

## Batch-Normalisierung

BatchNorm normalisiert die Eingabe jeder Schicht über den Mini-Batch auf Mittelwert null und Varianz eins und wendet anschließend die lernbare Skalierung $\gamma$ und Verschiebung $\beta$ an:

$$\hat{x} = \frac{x - \mu_B}{\sqrt{\sigma_B^2 + \epsilon}}, \quad y = \gamma \hat{x} + \beta$$

Das stabilisiert das Training, erlaubt höhere Lernraten und wirkt als milder Regularisierer. BatchNorm wird vor oder nach der Aktivierungsfunktion eingesetzt; davor ist in modernen Netzen häufiger.

## Transfer Learning

Features vortrainierter CNNs lassen sich bemerkenswert gut zwischen Aufgaben übertragen. Der Standard-Workflow:

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

## Wichtigste Erkenntnisse

- Faltung nutzt lokale räumliche Struktur mit deutlich weniger Parametern als vollverbundene Schichten
- Residualverbindungen gehören zu den wirkungsvollsten Architekturinnovationen für tiefe CNNs
- $3 \times 3$-Faltungen plus Tiefe schlagen große Einzel-Filter
- BatchNorm ist in tiefen Faltungsnetzen fast immer hilfreich
- Transfer Learning aus ImageNet-Vortraining liefert starke Initialisierungen für die meisten Vision-Aufgaben
