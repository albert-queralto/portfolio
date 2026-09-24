---
title: "Redes neuronales convolucionales: cómo ven las máquinas"
description: "Una explicación desde cero de las CNN: convolución, pooling, campos receptivos y las decisiones arquitectónicas que hicieron funcionar el deep learning para imágenes."
date: 2026-04-08
lang: es
translationKey: convolutional-neural-networks
tags: ["Computer Vision", "CNN", "Deep Learning", "PyTorch"]
draft: false
---

## ¿Por qué no usar simplemente MLP?

Una imagen RGB de 224×224 tiene $224 \times 224 \times 3 = 150{,}528$ valores de entrada. Una capa oculta completamente conectada con 1.000 unidades requeriría unos 150 millones de parámetros solo para la primera capa. Esto es computacionalmente costoso, estadísticamente ineficiente e ignora la estructura espacial de las imágenes.

Las CNN aprovechan tres sesgos inductivos clave:
1. **Conectividad local** — los píxeles cercanos suelen estar más relacionados que los lejanos
2. **Compartición de pesos** — el mismo detector de características resulta útil en cualquier parte de la imagen
3. **Equivarianza a traslaciones** — un gato sigue siendo un gato independientemente de dónde aparezca

## La operación de convolución

Una capa convolucional aplica un filtro aprendido $W$ de tamaño $k \times k$ deslizándolo sobre la entrada y calculando productos escalares:

$$(X * W)[i, j] = \sum_{m=0}^{k-1} \sum_{n=0}^{k-1} X[i+m,\, j+n] \cdot W[m, n]$$

Para una entrada de tamaño $H \times W$ y un filtro $k \times k$ con stride $s$ y padding $p$, el tamaño espacial de salida es:

$$H_{out} = \left\lfloor \frac{H + 2p - k}{s} \right\rfloor + 1$$

Una capa con $C_{out}$ filtros aprende $C_{out}$ mapas de características diferentes, cada uno detectando un patrón distinto (bordes, texturas o formas).

## Pooling

El pooling reduce las dimensiones espaciales y construye invariancia a traslaciones. El max pooling toma el valor máximo en una región local:

$$y[i, j] = \max_{(m,n) \in \mathcal{R}_{ij}} x[m, n]$$

Un max pool de $2 \times 2$ con stride 2 reduce a la mitad la altura y la anchura. El average pooling se utiliza en capas posteriores o para agregación global (`AdaptiveAvgPool2d`).

## Campo receptivo

El campo receptivo de una neurona es la región de entrada que afecta a su activación. Con $L$ capas de convoluciones $k \times k$ y stride 1:

$$RF = 1 + L(k - 1)$$

Apilar filtros pequeños de $3 \times 3$ es más eficiente en parámetros que usar filtros grandes y consigue el mismo campo receptivo. Dos capas de $3 \times 3$ cubren una región de $5 \times 5$ con menos parámetros y una no linealidad adicional.

## Arquitecturas clásicas

### LeNet-5 (1998)
La primera CNN práctica. Dos capas convolucionales + pooling seguidas de capas completamente conectadas. Diseñada para imágenes de dígitos en escala de grises de 32×32.

### AlexNet (2012)
Ganó ImageNet con gran margen. Innovaciones clave: activaciones ReLU, dropout, aumento de datos y entrenamiento con GPU. Utilizaba filtros de $11 \times 11$ y $5 \times 5$ en las primeras capas.

### VGG (2014)
Demostró que la profundidad importa. Utiliza exclusivamente filtros convolucionales de $3 \times 3$ apilados hasta 16–19 capas. Simple y muy influyente; sigue utilizándose como backbone.

### ResNet (2015)
Introdujo las **conexiones residuales** para permitir entrenar redes muy profundas (50–152 capas):

$$\text{output} = \mathcal{F}(x) + x$$

La skip connection ayuda a resolver el problema del gradiente desvaneciente al proporcionar una vía directa para el gradiente. ResNet50 sigue siendo un baseline estándar.

### Modernas: EfficientNet, ConvNeXt
EfficientNet utiliza búsqueda de arquitecturas neuronales para escalar conjuntamente profundidad, anchura y resolución. ConvNeXt revisita diseños puramente convolucionales con ajustes inspirados en Transformers (layer norm, kernels mayores, GELU).

## Un bloque ResNet en PyTorch

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

## Normalización por batch

BatchNorm normaliza la entrada de cada capa a media cero y varianza unitaria en el mini-batch, y después aplica una escala aprendida $\gamma$ y un desplazamiento $\beta$:

$$\hat{x} = \frac{x - \mu_B}{\sqrt{\sigma_B^2 + \epsilon}}, \quad y = \gamma \hat{x} + \beta$$

Esto estabiliza el entrenamiento, permite learning rates más altos y actúa como regularizador suave. Se coloca antes o después de la función de activación; antes es más habitual en redes modernas.

## Transfer learning

Las características de CNN preentrenadas se transfieren sorprendentemente bien entre tareas. El flujo estándar es:

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

## Ideas clave

- La convolución aprovecha la estructura espacial local con muchos menos parámetros que las capas completamente conectadas
- Las conexiones residuales son una de las innovaciones arquitectónicas más importantes para CNN profundas
- Convoluciones de $3 \times 3$ + profundidad superan a filtros únicos grandes
- BatchNorm casi siempre resulta beneficiosa en redes convolucionales profundas
- El transfer learning desde preentrenamiento con ImageNet ofrece inicializaciones fuertes para la mayoría de tareas de visión
