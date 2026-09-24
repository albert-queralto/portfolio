---
title: "Transformers verstehen: die Architektur hinter modernem NLP"
description: "Ein tiefer Einblick in Self-Attention und darin, wie Transformers rekurrente Netze ablösten und zur Grundlage moderner Sprachmodelle wurden."
date: 2026-03-10
lang: de
translationKey: understanding-transformers
tags: ["NLP", "Deep Learning", "Transformers", "PyTorch"]
draft: false
---

## Was ist ein Transformer?

Die Transformer-Architektur, vorgestellt 2017 im Paper *"Attention Is All You Need"* von Vaswani et al., ersetzte rekurrente Netze durch ein vollständig aufmerksamkeitsbasiertes Design. Dieser Wechsel ermöglichte massive Parallelisierung beim Training und führte direkt zu Modellen wie BERT, GPT und modernen LLMs.

## Das Problem mit RNNs

Rekurrente neuronale Netze verarbeiten Sequenzen Token für Token. Jeder Hidden State hängt vom vorherigen ab. Das bedeutet:

- Training ist inhärent sequenziell und schwer zu parallelisieren
- Gradienten verschwinden oder explodieren bei langen Sequenzen
- Langreichweitige Abhängigkeiten sind schwer zu erfassen

LSTMs und GRUs mildern diese Probleme, beseitigen sie aber nicht vollständig.

## Self-Attention

Die zentrale Innovation des Transformers ist **Self-Attention**: Jedes Token der Eingabe kann direkt jedes andere Token berücksichtigen, unabhängig von dessen Position.

Für eine Eingabesequenz von Embeddings $X$ berechnen wir drei Projektionen:

$$Q = XW_Q, \quad K = XW_K, \quad V = XW_V$$

Die Attention-Ausgabe lautet:

$$\text{Attention}(Q, K, V) = \text{softmax}\left(\frac{QK^T}{\sqrt{d_k}}\right)V$$

Die Skalierung mit $\sqrt{d_k}$ verhindert, dass Skalarprodukte in hohen Dimensionen zu groß werden.

## Multi-Head Attention

Statt nur eine Attention-Funktion auszuführen, verwendet der Transformer $h$ Attention-Heads parallel. Jeder lernt einen anderen Repräsentationsunterraum:

$$\text{MultiHead}(Q, K, V) = \text{Concat}(\text{head}_1, \ldots, \text{head}_h)W^O$$

Dadurch kann das Modell gleichzeitig Informationen aus verschiedenen Positionen und Repräsentationsunterräumen berücksichtigen.

## Positionskodierung

Da Self-Attention permutationsinvariant ist, muss Positionsinformation explizit hinzugefügt werden. Das ursprüngliche Paper verwendet feste sinusförmige Kodierungen:

$$PE_{(pos, 2i)} = \sin\left(\frac{pos}{10000^{2i/d_{model}}}\right)$$

$$PE_{(pos, 2i+1)} = \cos\left(\frac{pos}{10000^{2i/d_{model}}}\right)$$

Moderne Modelle wie BERT und RoPE-basierte Transformers verwenden stattdessen gelernte oder rotatorische Positions-Embeddings.

## Die vollständige Architektur

Der Encoder stapelt $N$ identische Schichten, die jeweils enthalten:

1. Multi-Head Self-Attention
2. Positionsweise Feed-Forward-Netze
3. Layer Normalization und Residualverbindungen um beide Blöcke

Der Decoder ergänzt eine dritte Unterschicht: **Cross-Attention** über die Encoder-Ausgabe.

## Ein minimales Beispiel in PyTorch

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

## Wichtigste Erkenntnisse

- Transformers ersetzen sequenzielle Rekurrenz durch parallele Attention
- Self-Attention erfasst globale Abhängigkeiten in $O(n^2)$ Zeit
- Multi-Head Attention lernt unterschiedliche Repräsentationsunterräume
- Positionskodierungen kompensieren die Permutationsinvarianz der Attention
- Die Architektur skaliert bemerkenswert gut mit Daten und Rechenleistung
