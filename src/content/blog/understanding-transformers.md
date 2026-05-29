---
title: "Understanding Transformers: The Architecture Behind Modern NLP"
description: "A deep dive into the self-attention mechanism and how transformers replaced recurrent networks to become the foundation of modern language models."
date: 2026-03-10
tags: ["NLP", "Deep Learning", "Transformers", "PyTorch"]
draft: false
---

## What is a Transformer?

The Transformer architecture, introduced in the 2017 paper *"Attention Is All You Need"* by Vaswani et al., replaced recurrent networks with a fully attention-based design. This shift enabled massive parallelisation during training and led directly to models like BERT, GPT, and modern LLMs.

## The Problem with RNNs

Recurrent neural networks process sequences token by token. Each hidden state depends on the previous one, which means:

- Training is inherently sequential and slow to parallelise
- Gradients vanish or explode over long sequences
- Long-range dependencies are hard to capture

LSTMs and GRUs alleviate these issues, but don't eliminate them.

## Self-Attention

The core innovation of the Transformer is **self-attention** — each token in the input can attend to every other token directly, regardless of position.

For an input sequence of embeddings $X$, we compute three projections:

$$Q = XW_Q, \quad K = XW_K, \quad V = XW_V$$

The attention output is:

$$\text{Attention}(Q, K, V) = \text{softmax}\left(\frac{QK^T}{\sqrt{d_k}}\right)V$$

The $\sqrt{d_k}$ scaling prevents the dot products from growing too large in high dimensions.

## Multi-Head Attention

Rather than running a single attention function, the Transformer runs $h$ attention heads in parallel, each learning a different representation subspace:

$$\text{MultiHead}(Q, K, V) = \text{Concat}(\text{head}_1, \ldots, \text{head}_h)W^O$$

This allows the model to jointly attend to information from different positions and representation subspaces.

## Positional Encoding

Because self-attention is permutation-invariant, we need to inject position information. The original paper uses fixed sinusoidal encodings:

$$PE_{(pos, 2i)} = \sin\left(\frac{pos}{10000^{2i/d_{model}}}\right)$$

$$PE_{(pos, 2i+1)} = \cos\left(\frac{pos}{10000^{2i/d_{model}}}\right)$$

Modern models like BERT and RoPE-based transformers use learned or rotary positional embeddings instead.

## The Full Architecture

The encoder stacks $N$ identical layers, each containing:

1. Multi-head self-attention
2. Position-wise feed-forward network
3. Layer normalisation and residual connections around both

The decoder adds a third sublayer: **cross-attention** over the encoder output.

## A Minimal Example in PyTorch

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

## Key Takeaways

- Transformers replace sequential recurrence with parallel attention
- Self-attention captures global dependencies in $O(n^2)$ time
- Multi-head attention learns diverse representation subspaces
- Positional encodings compensate for the permutation-invariance of attention
- The architecture scales remarkably well with data and compute
