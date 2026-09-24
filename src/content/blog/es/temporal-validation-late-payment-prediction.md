---
title: "Validación temporal para la predicción de pagos tardíos"
description: "Por qué predecir pagos tardíos requiere más que una división cronológica train/test y cómo reconstruyo qué podía saberse realmente cuando se habría realizado cada predicción de Payrithm."
date: 2026-09-18
publishAt: 2026-09-18T08:00:00+02:00
lang: es
translationKey: temporal-validation-late-payment-prediction
tags: ["Machine Learning", "Time Series", "Scikit-learn", "Fintech", "MLOps"]
draft: false
cover: "/og/temporal-validation-late-payment-prediction.png"
featured: false
project: "payrithm"
---

Predecir si una factura se pagará tarde parece un problema estándar de clasificación binaria.

No lo es.

La parte difícil no es ajustar el clasificador. La parte difícil es asegurarse de que el modelo nunca aprenda de información que solo estaría disponible después del momento en que se supone que debe realizar la predicción.

Mientras construía **Payrithm**, esta se convirtió en la restricción más importante del pipeline de machine learning.

La pregunta que utilizo para cada característica es:

> ¿Habría podido calcular este valor al final de la fecha de emisión de la factura?

Si la respuesta es no, esa característica no pertenece al modelo de predicción en el momento de emisión.

## El tiempo aparece dos veces en el problema

Un conjunto de datos de facturas contiene varias fechas diferentes:

- fecha de emisión,
- fecha de vencimiento,
- fecha de pago,
- fechas de recordatorios,
- y fechas de disputas.

Es tentador pensar que ordenar los registros por `issue_date` resuelve la fuga temporal de datos.

No es así.

Consideremos dos facturas del mismo cliente:

```text
Factura A
emitida: 1 de enero
pagada: 15 de marzo

Factura B
emitida: 1 de febrero
```

La factura A ya existía cuando se emitió la factura B.

Pero su resultado final de pago todavía no se conocía.

Si calculo la tasa histórica de pagos tardíos del cliente para la factura B utilizando el pago de marzo de la factura A, estoy introduciendo información del futuro.

Esto crea dos relojes distintos:

```text
el evento ocurrió
vs.
el resultado se conoció
```

Es fácil pasar por alto esta distinción.

## Reconstruir el conocimiento histórico

Para cada factura nueva en el momento \(t\), una factura anterior solo puede contribuir a las características de historial resuelto del cliente cuando:

```text
fecha de emisión anterior < t
AND
fecha de pago anterior < t
```

La segunda condición es la importante.

Conceptualmente:

```python
known_history = customer_invoices[
    (customer_invoices["issue_date"] < cutoff)
    & customer_invoices["paid_date"].notna()
    & (customer_invoices["paid_date"] < cutoff)
]
```

A partir de esos registros puedo calcular de forma segura características como:

- número de facturas históricas resueltas,
- tasa histórica de pagos tardíos,
- retraso medio de pago,
- retraso máximo de pago,
- y duración media entre emisión y pago.

Esto significa que cada factura recibe una instantánea histórica adecuada a su propia fecha de predicción.

La tabla de entrenamiento no es simplemente un conjunto de datos de facturas.

Es un conjunto de datos de **estados históricos**.

## Por qué un `groupby` sobre todo el conjunto de datos es peligroso

El enfoque cómodo sería algo como:

```python
df.groupby("customer_id")["paid_late"].mean()
```

Eso produce una característica de riesgo del cliente aparentemente razonable.

También es incorrecta para una predicción histórica.

El cálculo puede incluir:

- facturas emitidas más tarde,
- facturas pagadas más tarde,
- y potencialmente la propia factura objetivo.

La evaluación del modelo puede parecer excelente porque la característica contiene una versión comprimida del futuro.

Por eso la fuga de datos es peligrosa en los conjuntos de datos empresariales: a menudo parece feature engineering perfectamente legítimo.

## Los clientes sin historial deben permanecer en los datos

Otra complicación son los clientes que no tienen historial resuelto.

Eliminarlos hace que el problema de modelado sea más sencillo, pero que la aplicación sea menos útil.

Un cliente recién adquirido es precisamente uno de los casos en los que el comportamiento de pago es más incierto.

Por eso Payrithm distingue entre:

```text
customer_late_rate = 0
```

y:

```text
customer_late_rate = desconocido porque no existe historial
```

Utilizo un indicador `history_available` y permito que el pipeline de preprocesamiento impute los agregados históricos que faltan.

El modelo todavía puede utilizar información disponible en el momento de emisión, como:

- importe,
- condiciones de pago,
- moneda,
- sector,
- mes de emisión,
- y día de la semana,

al mismo tiempo que entiende que las características de historial del cliente no estaban disponibles.

## El conjunto de evaluación debe proceder del futuro

Después de construir características temporalmente válidas, la división train/test debe preservar la misma dirección.

Payrithm ordena las facturas resueltas por fecha de emisión y utiliza aproximadamente el **20%** más reciente como periodo de evaluación.

Conceptualmente:

```text
más antiguo -------------------------------------- más reciente

|                 entrenamiento                  | evaluación |
```

El modelo nunca se entrena con una factura emitida después de una factura del conjunto de evaluación.

Esto responde a la pregunta que realmente me interesa:

> Si hubiera entrenado este modelo al final del periodo histórico de entrenamiento, ¿cómo habría funcionado con las facturas que llegaron a continuación?

Es una pregunta mucho más realista que preguntar cómo funciona el modelo después de barajar aleatoriamente el historial de la empresa.

## El preprocesamiento también puede provocar fuga de datos

La fuga temporal no se limita a las características.

Supongamos que calculo valores medianos sobre todo el conjunto de datos y después lo divido.

El periodo de evaluación ya habrá influido en el preprocesamiento del entrenamiento.

El mismo problema se aplica a:

- imputación,
- mapeos de categorías,
- escalado,
- selección de características,
- y calibración.

Esta es una de las razones por las que mantengo el preprocesamiento dentro del pipeline de scikit-learn.

El pipeline solo se ajusta con los datos de entrenamiento.

Los registros de evaluación se transforman utilizando parámetros aprendidos del pasado.

## Ordenar bien los casos es solo la mitad del problema

Payrithm utiliza un clasificador de gradient boosting para estimar:

$$
P(\text{pago tardío} \mid X)
$$

ROC-AUC me dice si el modelo tiende a situar las facturas pagadas tarde por encima de las facturas pagadas a tiempo.

Pero Payrithm utiliza después la propia probabilidad en otras partes del sistema.

Un riesgo predicho del 80% debería significar más que:

> Esta factura tiene un riesgo alto.

Idealmente debería significar que las facturas que reciben probabilidades similares terminan pagándose tarde aproximadamente el 80% de las veces.

Eso hace que la calibración sea importante.

## La calibración también debe respetar el tiempo

Un flujo habitual de calibración utiliza validación cruzada aleatoria.

En predicción temporal, eso puede recrear el mismo problema que intentaba eliminar.

Si hace falta calibración, el periodo de calibración también debe situarse después del periodo de entrenamiento del modelo y antes del periodo final de evaluación.

Conceptualmente:

```text
pasado                                     futuro
|--------- entrenamiento --------| calibración | evaluación |
```

Cada etapa avanza hacia delante.

Nada aprende hacia atrás.

## Comparar con una baseline de probabilidad

Un modelo de machine learning también debería superar algo más sencillo.

Para la probabilidad de pago tardío, una baseline deliberadamente aburrida es:

```text
predecir la tasa histórica de pagos tardíos del entrenamiento
para cada factura de evaluación
```

Evalúo la calidad de las probabilidades con el Brier score:

$$
\frac{1}{N}\sum_{i=1}^{N}(p_i-y_i)^2
$$

y lo comparo con esa baseline.

Si el modelo no puede superar al predictor basado en la tasa base histórica sobre facturas futuras, desplegarlo simplemente porque el entrenamiento ha terminado correctamente no tendría sentido.

## La validez temporal continúa después del despliegue

Un holdout cronológico no pone fin al problema.

El comportamiento de pago cambia. La composición de clientes cambia. Las condiciones de pago cambian. Las condiciones económicas cambian. La proporción de clientes sin historial también puede cambiar.

Para cada ejecución de entrenamiento quiero conservar información como:

- límites del periodo de entrenamiento,
- límites del periodo de evaluación,
- prevalencia de pagos tardíos,
- ROC-AUC,
- Brier score,
- Brier score de la baseline,
- versión de las características,
- y versión del modelo.

Eso proporciona a futuras ejecuciones de entrenamiento una base significativa con la que compararse.

## La lección más general

La forma más peligrosa de fuga de datos no es una columna obviamente incorrecta llamada `target`.

Es una característica que parece razonable pero que contiene silenciosamente conocimiento del futuro.

Por tanto, los modelos temporales necesitan una definición más exigente de corrección:

> Una fila de entrenamiento debería reproducir el estado de información que habría existido en el momento real de la predicción.

Cuando empecé a tratar la reconstrucción del estado histórico como una parte del modelo —y no solo de la preparación de datos—, el resto del pipeline de Payrithm se volvió mucho más fácil de razonar.

El objetivo no es crear la métrica offline más impresionante.

Es construir una evaluación en la que esté dispuesto a confiar cuando llegue la siguiente factura.
