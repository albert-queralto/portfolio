---
title: "Transformer NLP Experiments"
description: "Fine-tuning experiments for multilingual sentiment classification and sequence-to-sequence translation with transformer models."
order: 6
featured: false
draft: false
status: "Completed"
category: "Machine Learning"
focus: "NLP · Transfer learning"
image: "/transformers_sentiment_text.png"
source: "https://github.com/albert-queralto/transformers_sentiment_classification_translation"
technologies:
  - Python
  - Transformers
  - BERT
  - PyTorch
  - NLP
metrics:
  - label: "Tasks"
    value: "Classification + translation"
  - label: "Method"
    value: "Transformer fine-tuning"
  - label: "Framework"
    value: "PyTorch"
---

## Problem

Training modern language models from scratch requires substantial data and computing resources. Transfer learning makes it possible to adapt pretrained transformer models to practical tasks with much smaller task-specific datasets.

This project explores two distinct natural-language-processing problems: sentiment classification and sequence-to-sequence translation. The goal is to understand the end-to-end fine-tuning workflow and the differences between classification and generation tasks.

## Constraints

Text data requires careful tokenization, truncation, padding, and label preparation. Maximum sequence length affects both model quality and memory use, while class imbalance can make headline accuracy misleading.

Translation adds autoregressive decoding, generation parameters, and sequence-level evaluation. Available compute limits batch size, training duration, and the number of hyperparameter experiments.

Pretrained checkpoints also inherit limitations and biases from their original training data.

## Approach

The project uses transformer checkpoints through the Hugging Face ecosystem and PyTorch. For sentiment classification, a pretrained encoder is adapted with a classification head and fine-tuned on labeled examples.

For translation, a sequence-to-sequence transformer is prepared with source and target tokenization and trained to generate target-language sequences.

The workflow covers dataset preparation, tokenization, batching, model training, inference, and comparison of predictions with expected outputs.

## Validation

Classification evaluation considers held-out predictions, class-level behavior, and a confusion matrix rather than relying only on aggregate accuracy.

Translation quality is inspected with generated examples and can be summarized with sequence-level metrics. Manual review remains important because automatic metrics do not fully capture meaning, fluency, or acceptable alternative translations.

Training and validation loss are monitored to detect underfitting or overfitting during fine-tuning.

## Engineering decisions

Using pretrained models reduces training cost and makes the experiments reproducible from named checkpoints. Tokenization and model configuration are kept aligned with each checkpoint to avoid incompatible inputs.

PyTorch exposes the training behavior while the Transformers library provides reliable model and tokenizer implementations. The project keeps the classification and translation workflows conceptually separate because their objectives and inference patterns differ.

Saved model artifacts allow inference without retraining from the beginning.

## Tradeoffs

The project prioritizes learning and comparison over exhaustive benchmarking. It does not perform a large hyperparameter search or compare every relevant multilingual architecture.

Automatic evaluation is limited by dataset size and metric choice. Production deployment concerns such as request batching, model quantization, latency targets, content moderation, and ongoing monitoring are outside the initial scope.

## Next steps

Future experiments could compare multilingual checkpoints, parameter-efficient fine-tuning, class-weighted objectives, calibration for sentiment probabilities, and more robust translation metrics.

A deployment-oriented extension could expose the models through FastAPI, add batch inference, containerize the service, track experiment metadata, and monitor input-language and confidence distributions.
