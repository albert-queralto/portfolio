---
title: "Payrithm"
description: "Una plataforma de inteligencia de cuentas por cobrar que predice pagos tardíos, estima cuándo se pagarán las facturas, proyecta cobros de caja y prioriza el trabajo de recobro."
lang: es
translationKey: payrithm
order: 1
featured: true
draft: false
status: "In progress"
category: "Machine Learning"
focus: "SaaS ML · Operaciones financieras"
image: "/projects/payrithm/payrithm.png"
ogImage: "/og/payrithm.png"
article: "/blog/payrithm/"
source: "https://github.com/albert-queralto/invoice-late-predictor-enterprise"
preview: "https://payrithm.albertqueralto.dev/"
technologies:
  - Python
  - FastAPI
  - scikit-learn
  - React
  - TypeScript
  - PostgreSQL
  - Celery
  - Redis
  - Docker
metrics:
  - label: "Tareas de predicción"
    value: "Clasificación + regresión"
  - label: "Validación"
    value: "Holdout cronológico"
  - label: "Arquitectura"
    value: "SaaS multiservicio"
---

## El problema

Los equipos de cuentas por cobrar pueden tener que gestionar cientos o miles de facturas abiertas sin saber cuáles tienen más probabilidades de pagarse tarde.

Tratar todas las facturas por igual desperdicia capacidad de recobro. Payrithm está diseñado para identificar el riesgo con antelación y convertirlo en una cola operativa clara.

## Mi enfoque

Payrithm utiliza dos modelos de machine learning relacionados:

- Un clasificador estima la probabilidad de que una factura se pague tarde.
- Un regresor estima el retraso del pago respecto a la fecha de vencimiento.

El sistema separa las variables disponibles en el momento de emisión de las señales operativas en tiempo real. Así evita que el estado actual de mora, recordatorios futuros y la información final del pago se filtren al entrenamiento del modelo.

## Preparación de datos

El pipeline de importación valida identificadores, importes de factura, monedas, fechas de emisión, fechas de vencimiento y fechas de pago antes de que los registros se conviertan en ejemplos de entrenamiento.

Las variables de histórico de cliente se reconstruyen según lo que se conocía en la fecha de emisión de cada factura. Solo se incluyen resultados que ya eran conocidos antes de esa fecha.

## Validación

La parte más reciente de las facturas resueltas forma el periodo de evaluación. Las facturas anteriores forman el periodo de entrenamiento.

Esta partición cronológica reproduce la dirección real del despliegue: entrenar con el pasado y predecir facturas futuras.

El clasificador se evalúa con:

- ROC-AUC para la calidad del ranking
- Brier score para la calidad de las probabilidades
- Análisis de calibración
- Un baseline de probabilidad constante

El modelo de regresión se evalúa mediante error absoluto medio y un baseline basado en la mediana del retraso.

## Convertir predicciones en decisiones

La puntuación final de recobro combina:

- Probabilidad de pago tardío
- Percentil del importe de la factura dentro de su moneda
- Urgencia según la fecha de vencimiento
- Presión de recordatorios

Mantener esta fórmula separada del modelo hace que la política de negocio sea ajustable y permite a los usuarios entender por qué una factura aparece cerca de la parte superior de la cola.

## Arquitectura

La aplicación separa frontend, API, servicios de aplicación, workers en segundo plano, capa de persistencia y pipeline de machine learning.

Esto permite que las importaciones y el entrenamiento de modelos sean asíncronos mientras la API se mantiene receptiva.

## Estado actual

Los módulos principales de la aplicación están implementados. Los siguientes pasos son completar la evaluación de producción, publicar las métricas finales de los modelos, ampliar la monitorización y recoger feedback de potenciales usuarios.
