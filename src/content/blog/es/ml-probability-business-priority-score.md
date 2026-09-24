---
title: "De la probabilidad de ML a una puntuación de prioridad de negocio"
description: "Por qué Payrithm no ordena simplemente las facturas por probabilidad de pago tardío y cómo combino el riesgo calibrado de ML con el valor, la urgencia y la actividad de cobro."
date: 2026-10-28
publishAt: 2026-10-28T08:00:00+02:00
lang: es
translationKey: ml-probability-business-priority-score
tags:
  [
    "Machine Learning",
    "Product Engineering",
    "Fintech",
    "Decision Systems",
    "Explainability",
  ]
draft: false
cover: "/og/ml-probability-business-priority-score.png"
featured: false
project: "payrithm"
---

Un modelo de machine learning puede responder una pregunta importante y, aun así, no decirle al usuario qué debe hacer.

**Payrithm** estima la probabilidad de que una factura se pague tarde.

Supongamos que el modelo devuelve:

```text
Factura A: 90% de riesgo de pago tardío
Factura B: 65% de riesgo de pago tardío
```

Si Payrithm fuera únicamente un panel de predicciones, ordenar por probabilidad sería suficiente.

Pero la pregunta real de producto es:

> ¿En qué factura debería trabajar primero el equipo de cobros?

No son problemas equivalentes.

## La probabilidad mide riesgo, no importancia

Consideremos:

| Factura | Probabilidad de retraso |  Importe | Estado           |
| ------- | ----------------------: | -------: | ---------------- |
| A       |                     90% |    150 € | Vence en 25 días |
| B       |                     65% | 48.000 € | Vencida          |

La factura A tiene un riesgo predicho mayor.

La factura B puede tener una prioridad operativa mayor.

Un equipo financiero no distribuye su atención únicamente según la probabilidad.

El valor en riesgo y la sensibilidad temporal también importan.

Por eso Payrithm mantiene separados dos conceptos:

```text
predicción de ML
      |
      v
probabilidad de pago tardío


política de negocio
      |
      v
prioridad de cobro
```

El segundo consume el primero.

No lo sustituye.

## El modelo de prioridad actual

La puntuación de prioridad explicable combina cuatro señales normalizadas:

\[
Priority =
0.45P(\text{late}) +
0.25A +
0.25U +
0.05R
\]

donde:

- \(P\) = probabilidad predicha de pago tardío,
- \(A\) = importe relativo de la factura,
- \(U\) = urgencia según la fecha de vencimiento,
- \(R\) = presión de los recordatorios.

Actualmente, los pesos expresan una política de producto:

```text
45% riesgo
25% valor
25% urgencia
5% actividad de recordatorios
```

Los pesos exactos pueden evolucionar.

Lo importante desde el punto de vista arquitectónico es que sigan siendo visibles.

## Por qué la probabilidad recibe el mayor peso

El clasificador de pagos tardíos estima si es probable que la factura necesite atención.

Eso merece una influencia considerable.

Pero darle el 100% del ranking implicaría:

> Al equipo de cobros solo le importa la probabilidad.

Así no funcionan las operaciones financieras.

Una factura de 100 € con un riesgo muy alto y una factura de 50.000 € con un riesgo moderado generan decisiones diferentes.

Por tanto, la puntuación de machine learning sigue siendo una entrada importante sin confundirse con el objetivo de negocio completo.

## Comparar importes de facturas entre monedas

El importe bruto introduce otro problema.

Estos valores no son directamente comparables:

```text
10.000 EUR
10.000 USD
10.000 GBP
```

Payrithm evita fingir que son idénticos.

Sin una política fiable de tipos de cambio, el cálculo de prioridad utiliza el **percentil del importe de la factura dentro de su propia moneda**.

Por ejemplo:

```python
amount_percentile = (
    invoices
    .groupby("currency")["amount"]
    .rank(pct=True)
)
```

La pregunta pasa a ser:

> ¿Qué tamaño tiene esta factura comparada con otras facturas denominadas en la misma moneda?

Eso produce una señal normalizada entre cero y uno sin inventar un tipo de cambio.

## La urgencia cambia cada día

La probabilidad de pago tardío se genera a partir de la información disponible en el momento de emisión.

La urgencia es operativa.

Una factura emitida hace tres semanas puede estar ahora acercándose a su fecha de vencimiento.

Otra puede haber vencido ya.

Por eso Payrithm calcula la urgencia por vencimiento separada del modelo.

Una función simplificada es:

```python
days_to_due = (due_date - today).days

urgency = min(
    1.0,
    max(0.0, (30 - days_to_due) / 30),
)
```

Una factura lejos de su fecha de vencimiento recibe poca urgencia.

A medida que se acerca el plazo, la urgencia aumenta.

Una vez vencida, la señal se mantiene alta.

Esta señal no debería introducirse en el clasificador del momento de emisión porque todavía no existía cuando se realizó la predicción.

Pertenece a la capa operativa.

## La presión de los recordatorios también pertenece ahí

El mismo argumento se aplica a los recordatorios.

Saber cuántos recordatorios se han enviado es útil para decidir qué hacer hoy.

No es información válida para predecir el riesgo el día en que se emitió una factura.

Payrithm puede normalizar la actividad actual de recordatorios, por ejemplo:

```python
reminder_pressure = min(
    1.0,
    reminders_sent / 3,
)
```

e incorporarla a la puntuación de prioridad.

Por tanto, el modelo y el flujo de trabajo operan en momentos temporales diferentes.

## Por qué no empecé con un segundo modelo de ranking de caja negra

Sería posible entrenar otro modelo para generar una puntuación de prioridad de cobro.

Deliberadamente, no hice que ese fuera el primer diseño.

Una cola operativa debe poder responder:

> ¿Por qué esta factura está por encima de aquella?

Con la fórmula actual, la respuesta es visible:

```text
riesgo predicho alto
+
factura grande respecto a su moneda
+
ya vencida
+
varios recordatorios anteriores
```

El usuario no necesita un sistema de explicación complejo para entender el orden de la cola.

Esa simplicidad tiene valor.

## La política puede cambiar sin reentrenar el modelo

La separación también hace que el sistema sea adaptable.

Imaginemos una empresa que entra temporalmente en una situación de restricción de flujo de caja.

Puede darle más importancia al valor de las facturas.

La política de prioridad podría pasar de:

```text
riesgo:         45%
importe:        25%
urgencia:       25%
recordatorios:   5%
```

hacia un componente de importe más fuerte.

El clasificador de pagos tardíos no necesita reentrenarse.

Nada ha cambiado en el comportamiento de pago de los clientes.

Solo ha cambiado la política de decisión actual del negocio.

Esta es una distinción útil:

> Los modelos describen el mundo. Las reglas de decisión describen qué queremos hacer al respecto.

No deberían ser automáticamente el mismo artefacto.

## La calibración se vuelve más importante cuando la probabilidad entra en una fórmula

Payrithm evalúa la calidad de la probabilidad con ROC-AUC, análisis de calibración y Brier score.

La calibración importa aquí porque la probabilidad no se utiliza únicamente para ordenar.

Recibe un peso numérico en una decisión posterior.

Si un modelo produce 0,90 para eventos que solo ocurren el 60% de las veces, la fórmula de prioridad da demasiado peso al riesgo.

Por eso me importan ambas cosas:

```text
calidad del ranking
y
calidad de la probabilidad
```

Un modelo con gran capacidad discriminativa pero mal calibrado todavía puede distorsionar las decisiones posteriores.

## La explicabilidad existe en dos niveles

En realidad hay dos explicaciones en el sistema.

La primera es:

> ¿Por qué el modelo predijo una probabilidad alta?

Eso puede investigarse mediante diagnósticos del modelo e interpretación de características.

La segunda es:

> ¿Por qué esta factura está en lo más alto de la cola de cobros?

Esta explicación es mucho más sencilla.

Los propios componentes de prioridad la responden.

Un usuario podría ver:

```text
Riesgo de pago tardío    0.82
Importe relativo         0.91
Urgencia de vencimiento  1.00
Presión de recordatorios 0.67
--------------------------------
Puntuación de prioridad  ...
```

La decisión de negocio sigue siendo inspeccionable.

## Predecir no es tomar decisiones

Este patrón se extiende más allá de las cuentas por cobrar.

Un modelo de fraude puede estimar la probabilidad de fraude sin determinar toda la cola de investigación.

Un modelo de mantenimiento puede estimar el riesgo de fallo sin decidir cuándo debería detenerse un equipo.

Por tanto, la lección arquitectónica que llevé a Payrithm es más amplia:

> Una salida de ML debería ser a menudo una entrada de un sistema explícito de decisión, no la decisión final en sí misma.

El trabajo del clasificador es estimar el riesgo de pago de la forma más precisa y honesta posible.

El trabajo de la capa de prioridad es traducir ese riesgo al contexto operativo de hoy.

Mantener esas responsabilidades separadas hace que ambas sean más fáciles de evaluar, cambiar y explicar.
