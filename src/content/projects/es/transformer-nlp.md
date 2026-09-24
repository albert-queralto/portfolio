---
title: "Experimentos de NLP con Transformers"
description: "Experimentos de fine-tuning para clasificación multilingüe de sentimiento y traducción secuencia a secuencia con modelos Transformer."
lang: es
translationKey: transformer-nlp
order: 7
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
  - label: "Tareas"
    value: "Clasificación + traducción"
  - label: "Método"
    value: "Fine-tuning de Transformers"
  - label: "Framework"
    value: "PyTorch"
---

## Problema

Entrenar modelos de lenguaje modernos desde cero requiere una cantidad considerable de datos y recursos de cómputo. El transfer learning permite adaptar modelos Transformer preentrenados a tareas prácticas utilizando conjuntos de datos específicos mucho más pequeños.

Este proyecto explora dos problemas distintos de procesamiento del lenguaje natural: clasificación de sentimiento y traducción secuencia a secuencia. El objetivo es comprender el flujo completo de fine-tuning y las diferencias entre tareas de clasificación y generación.

## Restricciones

Los datos de texto requieren tokenización, truncado, padding y preparación de etiquetas cuidadosos. La longitud máxima de secuencia afecta tanto a la calidad del modelo como al consumo de memoria, mientras que el desequilibrio de clases puede hacer que la accuracy global resulte engañosa.

La traducción añade decodificación autoregresiva, parámetros de generación y evaluación a nivel de secuencia. Los recursos de cómputo disponibles limitan el tamaño de batch, la duración del entrenamiento y el número de experimentos de hiperparámetros.

Los checkpoints preentrenados también heredan limitaciones y sesgos de sus datos originales de entrenamiento.

## Enfoque

El proyecto utiliza checkpoints Transformer a través del ecosistema de Hugging Face y PyTorch. Para clasificación de sentimiento, se adapta un encoder preentrenado con una cabeza de clasificación y se realiza fine-tuning con ejemplos etiquetados.

Para traducción, se prepara un Transformer secuencia a secuencia con tokenización de origen y destino y se entrena para generar secuencias en el idioma objetivo.

El flujo cubre preparación del dataset, tokenización, batching, entrenamiento del modelo, inferencia y comparación de predicciones con las salidas esperadas.

## Validación

La evaluación de clasificación considera predicciones sobre datos reservados, comportamiento por clase y una matriz de confusión en lugar de depender únicamente de la accuracy agregada.

La calidad de traducción se inspecciona con ejemplos generados y puede resumirse mediante métricas a nivel de secuencia. La revisión manual sigue siendo importante porque las métricas automáticas no capturan por completo el significado, la fluidez ni traducciones alternativas válidas.

Se monitorizan las pérdidas de entrenamiento y validación para detectar underfitting u overfitting durante el fine-tuning.

## Decisiones de ingeniería

Usar modelos preentrenados reduce el coste de entrenamiento y hace que los experimentos sean reproducibles a partir de checkpoints identificables. La tokenización y la configuración del modelo se mantienen alineadas con cada checkpoint para evitar entradas incompatibles.

PyTorch expone el comportamiento del entrenamiento, mientras que la librería Transformers aporta implementaciones fiables de modelos y tokenizadores. El proyecto mantiene conceptualmente separados los flujos de clasificación y traducción porque sus objetivos y patrones de inferencia son distintos.

Los artefactos de modelo guardados permiten realizar inferencia sin volver a entrenar desde el principio.

## Compromisos

El proyecto prioriza el aprendizaje y la comparación frente a un benchmarking exhaustivo. No realiza una gran búsqueda de hiperparámetros ni compara todas las arquitecturas multilingües relevantes.

La evaluación automática está limitada por el tamaño del dataset y la elección de métricas. Aspectos de despliegue en producción como batching de peticiones, cuantización, objetivos de latencia, moderación de contenido y monitorización continua quedan fuera del alcance inicial.

## Siguientes pasos

Futuros experimentos podrían comparar checkpoints multilingües, fine-tuning eficiente en parámetros, objetivos ponderados por clase, calibración de probabilidades de sentimiento y métricas de traducción más robustas.

Una extensión orientada al despliegue podría exponer los modelos mediante FastAPI, añadir inferencia por lotes, contenerizar el servicio, registrar metadatos de experimentos y monitorizar distribuciones de idioma de entrada y confianza.
