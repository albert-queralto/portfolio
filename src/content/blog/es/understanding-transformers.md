---
title: "Entender los Transformers: la arquitectura detrás del NLP moderno"
description: "Una inmersión en el mecanismo de autoatención y en cómo los Transformers sustituyeron a las redes recurrentes para convertirse en la base de los modelos de lenguaje modernos."
date: 2026-03-10
lang: es
translationKey: understanding-transformers
tags: ["NLP", "Deep Learning", "Transformers", "PyTorch"]
draft: false
---

## ¿Qué es un Transformer?

La arquitectura Transformer, presentada en el artículo de 2017 *"Attention Is All You Need"* de Vaswani et al., sustituyó las redes recurrentes por un diseño basado íntegramente en atención. Este cambio permitió una paralelización masiva durante el entrenamiento y condujo directamente a modelos como BERT, GPT y los LLM modernos.

## El problema de las RNN

Las redes neuronales recurrentes procesan las secuencias token a token. Cada estado oculto depende del anterior, lo que implica:

- El entrenamiento es inherentemente secuencial y difícil de paralelizar
- Los gradientes desaparecen o explotan en secuencias largas
- Las dependencias de largo alcance son difíciles de capturar

Las LSTM y GRU alivian estos problemas, pero no los eliminan.

## Autoatención

La innovación central del Transformer es la **self-attention** o autoatención: cada token de la entrada puede atender directamente a cualquier otro token, independientemente de su posición.

Para una secuencia de embeddings de entrada $X$, calculamos tres proyecciones:

$$Q = XW_Q, \quad K = XW_K, \quad V = XW_V$$

La salida de atención es:

$$\text{Attention}(Q, K, V) = \text{softmax}\left(\frac{QK^T}{\sqrt{d_k}}\right)V$$

El escalado por $\sqrt{d_k}$ evita que los productos escalares crezcan demasiado en dimensiones altas.

## Atención multi-cabeza

En lugar de ejecutar una única función de atención, el Transformer ejecuta $h$ cabezas en paralelo, cada una aprendiendo un subespacio de representación diferente:

$$\text{MultiHead}(Q, K, V) = \text{Concat}(\text{head}_1, \ldots, \text{head}_h)W^O$$

Esto permite al modelo atender conjuntamente a información de diferentes posiciones y subespacios de representación.

## Codificación posicional

Como la self-attention es invariante a permutaciones, necesitamos introducir información de posición. El artículo original utiliza codificaciones sinusoidales fijas:

$$PE_{(pos, 2i)} = \sin\left(\frac{pos}{10000^{2i/d_{model}}}\right)$$

$$PE_{(pos, 2i+1)} = \cos\left(\frac{pos}{10000^{2i/d_{model}}}\right)$$

Modelos modernos como BERT y los Transformers basados en RoPE utilizan embeddings posicionales aprendidos o rotatorios.

## La arquitectura completa

El encoder apila $N$ capas idénticas, cada una con:

1. Self-attention multi-cabeza
2. Red feed-forward aplicada por posición
3. Normalización de capa y conexiones residuales alrededor de ambos bloques

El decoder añade una tercera subcapa: **cross-attention** sobre la salida del encoder.

## Un ejemplo mínimo en PyTorch

```python
import torch
import torch.nn as nn

class SelfAttention(nn.Module):
    def __init__(self, d_model: int, n_heads: int):
        super().__init__()
        self.n_heads = n_heads
        self.d_k = d_model // n_heads
        self.qkv = nn.Linear(d_model, 3 * d_model)
        self.out = nn.Linear(d_model, d_model)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        B, T, C = x.shape
        qkv = self.qkv(x).reshape(B, T, 3, self.n_heads, self.d_k)
        q, k, v = qkv.unbind(dim=2)  # each (B, T, H, d_k)
        q, k, v = [t.transpose(1, 2) for t in (q, k, v)]  # (B, H, T, d_k)
        scale = self.d_k ** -0.5
        attn = (q @ k.transpose(-2, -1)) * scale
        attn = attn.softmax(dim=-1)
        out = (attn @ v).transpose(1, 2).reshape(B, T, C)
        return self.out(out)
```

## Ideas clave

- Los Transformers sustituyen la recurrencia secuencial por atención paralela
- La self-attention captura dependencias globales en tiempo $O(n^2)$
- La atención multi-cabeza aprende subespacios de representación diversos
- Las codificaciones posicionales compensan la invariancia a permutaciones de la atención
- La arquitectura escala extraordinariamente bien con datos y capacidad de cómputo
