---
title: "Convolutional Neural Networks: How Machines See"
description: "A ground-up explanation of CNNs — convolution, pooling, receptive fields, and the architectural choices that made deep learning work for images."
date: 2026-04-08
tags: ["Computer Vision", "CNN", "Deep Learning", "PyTorch"]
draft: false
---

## Why Not Just Use MLPs?

A 224×224 RGB image has $224 \times 224 \times 3 = 150{,}528$ input values. A fully connected hidden layer with 1,000 units would require ~150 million parameters — just for the first layer. This is computationally expensive, statistically inefficient, and ignores the spatial structure of images.

CNNs exploit three key inductive biases:
1. **Local connectivity** — nearby pixels are more related than distant ones
2. **Weight sharing** — the same feature detector is useful everywhere in the image
3. **Translation equivariance** — a cat is a cat regardless of where it appears

## The Convolution Operation

A convolutional layer applies a learned filter $W$ of size $k \times k$ by sliding it over the input and computing dot products:

$$(X * W)[i, j] = \sum_{m=0}^{k-1} \sum_{n=0}^{k-1} X[i+m,\, j+n] \cdot W[m, n]$$

For an input of size $H \times W$ and filter of size $k \times k$ with stride $s$ and padding $p$, the output spatial size is:

$$H_{out} = \left\lfloor \frac{H + 2p - k}{s} \right\rfloor + 1$$

A layer with $C_{out}$ filters learns $C_{out}$ different feature maps, each detecting a distinct pattern (edges, textures, shapes).

## Pooling

Pooling reduces spatial dimensions and builds translation invariance. Max pooling takes the maximum value over a local region:

$$y[i, j] = \max_{(m,n) \in \mathcal{R}_{ij}} x[m, n]$$

A $2 \times 2$ max pool with stride 2 halves the height and width. Average pooling is used in later layers or for global aggregation (`AdaptiveAvgPool2d`).

## Receptive Field

The receptive field of a neuron is the input region that affects its activation. With $L$ layers of $k \times k$ convolutions and stride 1:

$$RF = 1 + L(k - 1)$$

Stacking small $3 \times 3$ filters is more parameter-efficient than large filters while achieving the same receptive field. Two $3 \times 3$ layers cover a $5 \times 5$ region with fewer parameters and an extra non-linearity.

## Classic Architectures

### LeNet-5 (1998)
The first practical CNN. Two conv layers + pooling followed by fully connected layers. Designed for 32×32 greyscale digit images.

### AlexNet (2012)
Won ImageNet with a large margin. Key innovations: ReLU activations, dropout, data augmentation, GPU training. Used $11 \times 11$ and $5 \times 5$ filters in early layers.

### VGG (2014)
Showed that depth matters. Used exclusively $3 \times 3$ conv filters stacked to 16–19 layers. Simple and highly influential; still used as a backbone today.

### ResNet (2015)
Introduced **residual connections** to allow training of very deep networks (50–152 layers):

$$\text{output} = \mathcal{F}(x) + x$$

The skip connection solves the vanishing gradient problem by providing a gradient highway. ResNet50 remains a standard baseline.

### Modern: EfficientNet, ConvNeXt
EfficientNet uses neural architecture search to jointly scale depth, width, and resolution. ConvNeXt revisits pure convolutional designs with Transformer-inspired tweaks (layer norm, larger kernels, GELU).

## A ResNet Block in PyTorch

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

## Batch Normalisation

BatchNorm normalises the input to each layer to zero mean and unit variance across the mini-batch, then applies learnable scale $\gamma$ and shift $\beta$:

$$\hat{x} = \frac{x - \mu_B}{\sqrt{\sigma_B^2 + \epsilon}}, \quad y = \gamma \hat{x} + \beta$$

This stabilises training, allows higher learning rates, and acts as a mild regulariser. It is placed before or after the activation function (before is more common in modern networks).

## Transfer Learning

Pre-trained CNN features transfer remarkably well across tasks. The standard workflow:

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

## Key Takeaways

- Convolution exploits local spatial structure with far fewer parameters than fully connected layers
- Residual connections are the single most impactful architectural innovation for deep CNNs
- $3 \times 3$ convolutions + depth beats large single filters
- BatchNorm is almost always beneficial in deep convolutional networks
- Transfer learning from ImageNet pre-training provides strong initialisations for most vision tasks
