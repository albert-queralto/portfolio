---
title: "Entendre els Transformers: l'arquitectura darrere del NLP modern"
description: "Una immersió en el mecanisme d'autoatenció i en com els Transformers van substituir les xarxes recurrents per convertir-se en la base dels models de llenguatge moderns."
date: 2026-03-10
lang: ca
translationKey: understanding-transformers
tags: ["NLP", "Deep Learning", "Transformers", "PyTorch"]
draft: false
---

## Què és un Transformer?

L'arquitectura Transformer, presentada a l'article de 2017 *"Attention Is All You Need"* de Vaswani et al., va substituir les xarxes recurrents per un disseny basat completament en atenció. Aquest canvi va permetre una paral·lelització massiva durant l'entrenament i va conduir directament a models com BERT, GPT i els LLM moderns.

## El problema de les RNN

Les xarxes neuronals recurrents processen les seqüències token a token. Cada estat ocult depèn de l'anterior, cosa que implica:

- L'entrenament és inherentment seqüencial i difícil de paral·lelitzar
- Els gradients desapareixen o exploten en seqüències llargues
- Les dependències a llarg abast són difícils de capturar

Les LSTM i GRU redueixen aquests problemes, però no els eliminen.

## Autoatenció

La innovació central del Transformer és la **self-attention** o autoatenció: cada token de l'entrada pot atendre directament qualsevol altre token, independentment de la posició.

Per a una seqüència d'embeddings d'entrada $X$, calculem tres projeccions:

$$Q = XW_Q, \quad K = XW_K, \quad V = XW_V$$

La sortida de l'atenció és:

$$\text{Attention}(Q, K, V) = \text{softmax}\left(\frac{QK^T}{\sqrt{d_k}}\right)V$$

L'escalat per $\sqrt{d_k}$ evita que els productes escalars creixin massa en dimensions altes.

## Atenció multi-cap

En lloc d'executar una sola funció d'atenció, el Transformer executa $h$ caps d'atenció en paral·lel, cadascun aprenent un subespai de representació diferent:

$$\text{MultiHead}(Q, K, V) = \text{Concat}(\text{head}_1, \ldots, \text{head}_h)W^O$$

Això permet al model atendre simultàniament informació de diferents posicions i subespais de representació.

## Codificació posicional

Com que la self-attention és invariant a permutacions, cal introduir informació de posició. L'article original utilitza codificacions sinusoidals fixes:

$$PE_{(pos, 2i)} = \sin\left(\frac{pos}{10000^{2i/d_{model}}}\right)$$

$$PE_{(pos, 2i+1)} = \cos\left(\frac{pos}{10000^{2i/d_{model}}}\right)$$

Models moderns com BERT i els Transformers basats en RoPE utilitzen embeddings posicionals apresos o rotatoris.

## L'arquitectura completa

L'encoder apila $N$ capes idèntiques, cadascuna amb:

1. Self-attention multi-cap
2. Xarxa feed-forward aplicada per posició
3. Normalització de capa i connexions residuals al voltant d'ambdós blocs

El decoder afegeix una tercera subcapa: **cross-attention** sobre la sortida de l'encoder.

## Un exemple mínim en PyTorch

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

## Idees clau

- Els Transformers substitueixen la recurrència seqüencial per atenció paral·lela
- La self-attention captura dependències globals en temps $O(n^2)$
- L'atenció multi-cap aprèn subespais de representació diversos
- Les codificacions posicionals compensen la invariància a permutacions de l'atenció
- L'arquitectura escala extraordinàriament bé amb dades i capacitat de càlcul
