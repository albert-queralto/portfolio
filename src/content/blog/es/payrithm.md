---
title: "Construyendo un predictor de retraso en el pago de facturas con Python y Scikit-learn"
description: "Cómo diseñé el pipeline de machine learning de Payrithm para predecir pagos tardíos sin fuga de datos, evaluar la calidad de las probabilidades y convertir las predicciones en prioridades de cobro accionables."
date: 2026-07-25
lang: es
translationKey: payrithm
tags: ["Machine Learning", "Scikit-learn", "Python", "Fintech", "MLOps"]
draft: false
cover: "/og/invoice-late-payment-predictor.png"
featured: true
project: "payrithm"
---

Predecir si una factura se pagará tarde parece un problema sencillo de clasificación binaria:

* `0`: la factura se paga a tiempo
* `1`: la factura se paga tarde

La parte difícil no es entrenar un clasificador. La parte difícil es construir un sistema de predicción que refleje qué se conocería realmente cuando se crea una factura nueva.

Un modelo puede parecer muy preciso mientras utiliza accidentalmente información de pago procedente del futuro. Puede ordenar facturas por riesgo sin producir probabilidades fiables. También puede generar predicciones técnicamente correctas que nunca se convierten en decisiones de cobro útiles.

Estos son los problemas que quería resolver mientras construía **Payrithm**, una aplicación de inteligencia de cuentas por cobrar que predice pagos tardíos, estima el momento del pago, prioriza cobros y pronostica entradas de caja.

En este artículo recorro todo el proceso de modelado:

1. Definir el problema de negocio
2. Preparar los datos de facturas
3. Evitar la fuga temporal de datos
4. Crear características del historial del cliente
5. Crear una división train/test cronológica
6. Evaluar el ranking y la calidad de las probabilidades
7. Convertir las predicciones en prioridades de cobro

Los ejemplos utilizan Python, pandas y scikit-learn. Los mismos principios son aplicables a muchos sistemas de predicción reales que involucran clientes, transacciones y comportamiento dependiente del tiempo.

## El problema de negocio

Los equipos de cuentas por cobrar rara vez tienen tiempo suficiente para tratar todas las facturas pendientes por igual.

Una empresa puede tener cientos o miles de facturas abiertas. Algunas se pagarán sin intervención. Otras requerirán recordatorios, llamadas, resolución de disputas o escalado.

Por tanto, la pregunta operativa no es simplemente:

> ¿Qué facturas están pendientes de pago?

Las preguntas más útiles son:

* ¿Qué facturas recién emitidas es probable que se paguen tarde?
* ¿Cuánto tiempo después del vencimiento podría llegar el pago?
* ¿Qué facturas pendientes merecen atención primero?
* ¿Cuánto efectivo es probable que entre durante las próximas semanas?

Payrithm aborda el problema con dos modelos de machine learning relacionados:

* Un **clasificador** que estima la probabilidad de pago tardío
* Un **regresor** que estima el retraso del pago respecto a la fecha de vencimiento

Este artículo se centra principalmente en el clasificador.

Para una factura (i), el clasificador estima:

$$
P(Y_i = 1 \mid X_i)
$$

donde:

* $(Y_i = 1)$ significa que la factura termina pagándose después de su fecha de vencimiento
* $(X_i)$ contiene información disponible cuando se emite la factura

Esta última condición es esencial.

El modelo está pensado para realizar una **predicción en el momento de emisión**. Debe comportarse como si estuviera operando el día en que se crea la factura, no varias semanas después, cuando los recordatorios, las disputas, los días de retraso y el resultado del pago ya se conocen.

## Definición de la variable objetivo

Para las facturas resueltas, la etiqueta de pago tardío puede derivarse comparando la fecha de pago con la fecha de vencimiento:

$$
\text{paid\_late} =
\begin{cases}
1 & \text{si paid\_date} > \text{due\_date} \\
0 & \text{en caso contrario}
\end{cases}
$$

La variable objetivo de retraso utilizada por el modelo de regresión complementario es:

$$
\text{delay\_days} =
\text{paid\_date} - \text{due\_date}
$$

Un valor negativo significa que la factura se pagó antes de tiempo. Cero significa que se pagó el día del vencimiento. Un valor positivo representa el número de días de retraso.

Las facturas no resueltas todavía no tienen un resultado final, por lo que no pueden usarse como ejemplos supervisados de entrenamiento. Sí pueden puntuarse después de entrenar el modelo.

## Preparación de los datos de facturas

Payrithm importa datos de facturas desde archivos CSV.

Los campos mínimos requeridos son:

| Campo | Descripción |
| --- | --- |
| `invoice_id` | Identificador único de la factura |
| `customer_id` | Identificador del cliente |
| `issue_date` | Fecha de emisión de la factura |
| `due_date` | Fecha límite contractual de pago |
| `amount` | Importe de la factura |

El sistema también puede utilizar campos opcionales como:

* `paid_date`
* `currency`
* `customer_industry`
* `disputed`
* `dispute_opened_date`
* `reminders_sent`
* `last_reminder_date`

El primer paso de preparación consiste en validar tipos, fechas, identificadores y reglas básicas de negocio.

```python
from __future__ import annotations

import numpy as np
import pandas as pd


REQUIRED_COLUMNS = {
    "invoice_id",
    "customer_id",
    "issue_date",
    "due_date",
    "amount",
}

DATE_COLUMNS = [
    "issue_date",
    "due_date",
    "paid_date",
    "dispute_opened_date",
    "last_reminder_date",
]


def prepare_invoices(raw: pd.DataFrame) -> pd.DataFrame:
    missing = REQUIRED_COLUMNS.difference(raw.columns)

    if missing:
        raise ValueError(
            f"Missing required invoice columns: {sorted(missing)}"
        )

    invoices = raw.copy()

    for column in DATE_COLUMNS:
        if column in invoices.columns:
            invoices[column] = pd.to_datetime(
                invoices[column],
                errors="coerce",
                utc=True,
            ).dt.tz_localize(None)

    invoices["amount"] = pd.to_numeric(
        invoices["amount"],
        errors="coerce",
    )

    invoices = invoices.dropna(
        subset=[
            "invoice_id",
            "customer_id",
            "issue_date",
            "due_date",
            "amount",
        ]
    )

    invoices = invoices[invoices["amount"] > 0]
    invoices = invoices[
        invoices["due_date"] >= invoices["issue_date"]
    ]

    if invoices["invoice_id"].duplicated().any():
        duplicates = invoices.loc[
            invoices["invoice_id"].duplicated(),
            "invoice_id",
        ].tolist()

        raise ValueError(
            f"Duplicate invoice identifiers found: {duplicates[:5]}"
        )

    invoices["payment_terms_days"] = (
        invoices["due_date"] - invoices["issue_date"]
    ).dt.days

    invoices["delay_days"] = np.nan
    invoices["paid_late"] = pd.Series(
        pd.NA,
        index=invoices.index,
        dtype="boolean",
    )

    resolved = invoices["paid_date"].notna()

    invoices.loc[resolved, "delay_days"] = (
        invoices.loc[resolved, "paid_date"]
        - invoices.loc[resolved, "due_date"]
    ).dt.days

    invoices.loc[resolved, "paid_late"] = (
        invoices.loc[resolved, "paid_date"]
        > invoices.loc[resolved, "due_date"]
    )

    return invoices.sort_values(
        ["issue_date", "invoice_id"]
    ).reset_index(drop=True)
```

La validación en producción exige más que comprobar valores ausentes.

Por ejemplo, también quiero detectar:

* Fechas de pago anteriores a las fechas de emisión
* Plazos de pago inesperadamente grandes o negativos
* Monedas desconocidas
* Identificadores de factura duplicados
* Cambios repentinos de esquema
* Importes mal formados o escalados incorrectamente
* Valores categóricos con ortografía inconsistente

Estas comprobaciones evitan que los errores de calidad de datos se conviertan silenciosamente en comportamiento del modelo.

## Nunca combinar importes entre monedas

Una factura de `10,000 USD` no debería compararse directamente con una de `10,000 EUR`, `10,000 GBP` o `10,000 MXN`.

Por eso Payrithm evita agregar u ordenar importes brutos de facturas entre monedas diferentes.

Para priorizar cobros, el importe de la factura se convierte en un percentil dentro de su propia moneda:

```python
invoices["amount_percentile"] = (
    invoices.groupby("currency")["amount"]
    .rank(method="average", pct=True)
)
```

Esto no realiza conversión de divisas, pero proporciona una señal relativa útil:

> ¿Qué tamaño tiene esta factura en comparación con otras facturas de la misma moneda?

Un sistema de producción también podría convertir valores utilizando una fuente fiable de tipos de cambio, pero eso introduce preguntas adicionales sobre la fecha del tipo, la política contable y la reproducibilidad.

## El problema más peligroso: la fuga de datos

La fuga de datos ocurre cuando el entrenamiento utiliza información que no habría estado disponible en el momento de la predicción.

En predicción de facturas es especialmente fácil introducirla porque el dataset suele extraerse después de que muchas facturas ya se hayan pagado.

Considera un modelo entrenado con estas columnas:

* `paid_date`
* `days_overdue`
* `reminders_sent`
* `last_reminder_date`
* `disputed`
* Porcentaje de pagos tardíos del cliente calculado usando todas las facturas

Las métricas resultantes podrían parecer excelentes. El modelo puede haber recibido indirectamente la respuesta.

### Información que no debe entrar en un modelo del momento de emisión

| Campo o característica | Por qué produce fuga |
| --- | --- |
| `paid_date` | Revela directamente el resultado final |
| `delay_days` | Se deriva de la variable objetivo |
| `paid_late` | Es el objetivo de clasificación |
| Días de retraso actuales | Una factura nueva no está vencida al emitirse |
| Recordatorios futuros | Ocurren después de la fecha de predicción |
| Estado final de disputa | La disputa puede haberse abierto después de la emisión |
| Tasa histórica completa de retraso del cliente | Puede incluir facturas resueltas en el futuro |
| Preprocesamiento ajustado con todos los datos | Expone estadísticas del conjunto de evaluación |

La pregunta guía para cada característica candidata es:

> ¿Podría haber calculado este valor al final de la fecha de emisión de la factura?

Si la respuesta es no, la característica no pertenece al modelo de predicción en el momento de emisión.

## Las características de predicción y las operativas son diferentes

Payrithm separa dos conceptos que a menudo se mezclan incorrectamente.

### Características de predicción en el momento de emisión

Las utiliza el modelo de machine learning:

* Importe de la factura
* Moneda
* Plazos de pago
* Mes de emisión
* Día de la semana de emisión
* Industria del cliente
* Comportamiento del cliente conocido antes de la emisión
* Si existe suficiente historial del cliente

### Características operativas en vivo

Pueden utilizarse después al ordenar las facturas actualmente abiertas:

* Días hasta el vencimiento
* Si la factura ya está vencida
* Número de recordatorios enviados
* Tiempo desde el último recordatorio
* Estado actual de disputa
* Estado actual de la factura

Las señales operativas en vivo son útiles para decisiones de cobro, pero no pueden presentarse al modelo como si se conocieran al emitir la factura.

Mantener separadas la predicción y la priorización hace que el sistema sea más fácil de razonar y evaluar.

## Ingeniería de características del historial del cliente

El comportamiento de pago anterior de un cliente es una de las fuentes más útiles de información predictiva.

Las posibles características históricas incluyen:

* Número de facturas resueltas anteriormente
* Tasa histórica de pagos tardíos
* Retraso medio respecto al vencimiento
* Retraso histórico máximo
* Media de días entre emisión y pago
* Si el cliente tiene historial utilizable

La implementación ingenua es:

```python
invoices.groupby("customer_id")["paid_late"].mean()
```

Ese cálculo no es seguro.

Utiliza todo el historial del cliente, incluidas facturas emitidas y pagadas después de la factura que se está modelando.

En su lugar, cada factura necesita una instantánea histórica reconstruida a su fecha de emisión.

Para una factura emitida en el tiempo (t), una factura anterior solo es elegible para características de historial resuelto cuando:

1. Pertenece al mismo cliente
2. Se emitió antes de (t)
3. Su resultado de pago se conocía antes de (t)

La tercera condición importa. Una factura anterior podía existir en (t), pero si seguía impagada, su resultado final aún no se conocía.

La siguiente implementación prioriza la claridad sobre el máximo rendimiento:

```python
def add_customer_history_features(
    invoices: pd.DataFrame,
) -> pd.DataFrame:
    feature_rows: list[dict[str, float | int]] = []

    for _, customer_invoices in invoices.groupby(
        "customer_id",
        sort=False,
    ):
        customer_invoices = customer_invoices.sort_values(
            ["issue_date", "invoice_id"]
        )

        for index, current in customer_invoices.iterrows():
            cutoff = current["issue_date"]

            known_resolved = customer_invoices[
                (customer_invoices["issue_date"] < cutoff)
                & customer_invoices["paid_date"].notna()
                & (customer_invoices["paid_date"] < cutoff)
            ]

            history_count = len(known_resolved)

            if history_count == 0:
                feature_rows.append(
                    {
                        "index": index,
                        "history_available": 0,
                        "customer_resolved_count": 0,
                        "customer_late_rate": np.nan,
                        "customer_mean_delay_days": np.nan,
                        "customer_max_delay_days": np.nan,
                        "customer_mean_days_to_pay": np.nan,
                    }
                )
                continue

            days_to_pay = (
                known_resolved["paid_date"]
                - known_resolved["issue_date"]
            ).dt.days

            feature_rows.append(
                {
                    "index": index,
                    "history_available": 1,
                    "customer_resolved_count": history_count,
                    "customer_late_rate": (
                        known_resolved["paid_late"]
                        .astype(float)
                        .mean()
                    ),
                    "customer_mean_delay_days": (
                        known_resolved["delay_days"].mean()
                    ),
                    "customer_max_delay_days": (
                        known_resolved["delay_days"].max()
                    ),
                    "customer_mean_days_to_pay": (
                        days_to_pay.mean()
                    ),
                }
            )

    history = (
        pd.DataFrame(feature_rows)
        .set_index("index")
        .sort_index()
    )

    return invoices.join(history)
```

Esta implementación realiza filtrados repetidos y se volverá lenta con un dataset muy grande. En producción, la misma lógica puede implementarse de forma más eficiente mediante procesamiento cronológico de eventos, agregaciones expansivas u operaciones de ventana en base de datos.

La parte importante es la regla temporal, no la implementación exacta.

## Tratamiento de clientes nuevos

Un cliente nuevo puede no tener historial de facturas resueltas.

Es un problema clásico de cold start.

Eliminar estas facturas haría el modelo menos útil porque los clientes nuevos son precisamente uno de los casos donde el riesgo es más incierto. En su lugar, Payrithm incluye un indicador `history_available` y permite que el pipeline de preprocesamiento impute los valores históricos ausentes.

Para un cliente nuevo, el modelo todavía puede utilizar:

* Importe de la factura
* Plazos de pago
* Moneda
* Industria
* Características de calendario
* Patrones globales aprendidos de otros clientes

El indicador de historial permite al modelo distinguir entre:

* Una tasa histórica real de retraso igual a cero
* Una tasa ausente porque no existe historial

Esas situaciones no deben tratarse como equivalentes.

## Características adicionales del momento de emisión

Las características de calendario y contractuales pueden derivarse de forma segura de las fechas de emisión y vencimiento:

```python
def add_issue_time_features(
    invoices: pd.DataFrame,
) -> pd.DataFrame:
    featured = invoices.copy()

    featured["issue_month"] = (
        featured["issue_date"].dt.month
    )

    featured["issue_day_of_week"] = (
        featured["issue_date"].dt.dayofweek
    )

    featured["issue_quarter"] = (
        featured["issue_date"].dt.quarter
    )

    featured["is_month_end"] = (
        featured["issue_date"].dt.is_month_end.astype(int)
    )

    featured["log_amount"] = np.log1p(
        featured["amount"]
    )

    return featured
```

Prefiero utilizar el importe transformado logarítmicamente porque los importes de factura suelen estar sesgados a la derecha. Un pequeño número de facturas grandes podría dominar la escala numérica.

No incluyo el `customer_id` bruto como característica categórica. Hacerlo anima al modelo a memorizar clientes concretos y crea problemas cuando aparecen clientes no vistos.

Los agregados de comportamiento histórico suelen ser más transferibles.

## Construcción del pipeline de Scikit-learn

Payrithm utiliza un `GradientBoostingClassifier` para la probabilidad de pago tardío.

Los árboles de decisión con gradient boosting son un baseline sólido para datos empresariales estructurados porque pueden modelar:

* Relaciones no lineales
* Interacciones entre variables
* Efectos de umbral
* Entradas numéricas y categóricas mixtas tras el preprocesamiento

El preprocesamiento y el clasificador se envuelven en un único pipeline de scikit-learn.

```python
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder


NUMERIC_FEATURES = [
    "log_amount",
    "payment_terms_days",
    "issue_month",
    "issue_day_of_week",
    "issue_quarter",
    "is_month_end",
    "history_available",
    "customer_resolved_count",
    "customer_late_rate",
    "customer_mean_delay_days",
    "customer_max_delay_days",
    "customer_mean_days_to_pay",
]

CATEGORICAL_FEATURES = [
    "currency",
    "customer_industry",
]


numeric_pipeline = Pipeline(
    steps=[
        (
            "imputer",
            SimpleImputer(strategy="median"),
        ),
    ]
)

categorical_pipeline = Pipeline(
    steps=[
        (
            "imputer",
            SimpleImputer(strategy="most_frequent"),
        ),
        (
            "encoder",
            OneHotEncoder(
                handle_unknown="ignore",
                sparse_output=False,
            ),
        ),
    ]
)

preprocessor = ColumnTransformer(
    transformers=[
        (
            "numeric",
            numeric_pipeline,
            NUMERIC_FEATURES,
        ),
        (
            "categorical",
            categorical_pipeline,
            CATEGORICAL_FEATURES,
        ),
    ]
)

late_payment_model = Pipeline(
    steps=[
        ("preprocessor", preprocessor),
        (
            "classifier",
            GradientBoostingClassifier(
                random_state=42,
            ),
        ),
    ]
)
```

Colocar el preprocesamiento dentro del pipeline no es solo una comodidad.

Garantiza que:

* Los valores de imputación se aprenden del conjunto de entrenamiento
* Los mappings de categorías se aprenden del conjunto de entrenamiento
* Los datos de evaluación se transforman usando las reglas del conjunto de entrenamiento
* Se aplica el mismo preprocesamiento durante la inferencia
* El modelo y sus transformaciones de características pueden versionarse juntos

Ajustar transformaciones antes de dividir los datos sería otra forma de fuga.

## Por qué una división train/test aleatoria es engañosa

Un tutorial estándar de machine learning podría utilizar:

```python
from sklearn.model_selection import train_test_split

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42,
)
```

Eso no es apropiado para este problema.

Una división aleatoria mezcla facturas antiguas y recientes. El modelo puede entrenarse con patrones de negocio futuros y luego evaluarse con facturas más antiguas.

El despliegue real funciona en la dirección opuesta:

1. Entrenar con facturas históricas
2. Predecir facturas que llegan después

La evaluación debe reproducir esa dirección.

Payrithm utiliza aproximadamente el 20% más reciente de las facturas resueltas como periodo de evaluación.

```python
def chronological_split(
    resolved_invoices: pd.DataFrame,
    test_fraction: float = 0.20,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    ordered = resolved_invoices.sort_values(
        ["issue_date", "invoice_id"]
    ).reset_index(drop=True)

    tentative_index = int(
        len(ordered) * (1 - test_fraction)
    )

    cutoff_date = ordered.loc[
        tentative_index,
        "issue_date",
    ]

    train = ordered[
        ordered["issue_date"] < cutoff_date
    ].copy()

    test = ordered[
        ordered["issue_date"] >= cutoff_date
    ].copy()

    if train.empty or test.empty:
        raise ValueError(
            "Not enough chronological data to create "
            "both training and evaluation sets."
        )

    return train, test
```

Usar la fecha de emisión como eje de división responde a una pregunta realista:

> Si el modelo se hubiera entrenado al final del periodo de entrenamiento, ¿cómo habría predicho las facturas emitidas después?

Una evaluación cronológica suele ser más difícil que una aleatoria. Es lo esperado.

El objetivo no es producir la métrica más impresionante. Es estimar honestamente el rendimiento futuro.

## Entrenamiento del clasificador

Después de generar características del momento de emisión y seleccionar facturas resueltas, el entrenamiento es directo:

```python
prepared = prepare_invoices(raw_invoices)
prepared = add_customer_history_features(prepared)
prepared = add_issue_time_features(prepared)

resolved = prepared[
    prepared["paid_late"].notna()
].copy()

train, test = chronological_split(resolved)

feature_columns = (
    NUMERIC_FEATURES
    + CATEGORICAL_FEATURES
)

X_train = train[feature_columns]
y_train = train["paid_late"].astype(int)

X_test = test[feature_columns]
y_test = test["paid_late"].astype(int)

late_payment_model.fit(X_train, y_train)

late_probabilities = late_payment_model.predict_proba(
    X_test
)[:, 1]
```

La salida es una probabilidad entre cero y uno.

Una factura con una probabilidad predicha de `0.82` se considera más arriesgada que una con `0.18`.

Pero un modelo de riesgo útil necesita algo más que un orden correcto.

Sus probabilidades también deben significar algo.

## Por qué la accuracy no es suficiente

Supongamos que el 80% de las facturas se pagan a tiempo.

Un modelo que predice «a tiempo» para todas las facturas obtiene un 80% de accuracy y no ofrece ninguna discriminación de riesgo útil.

La accuracy también depende de elegir un umbral de clasificación. Distintos equipos de cobro pueden usar umbrales diferentes según:

* Personal disponible
* Valor de la factura
* Relaciones con clientes
* Coste de una intervención innecesaria
* Coste de no detectar pagos tardíos

Por ello Payrithm evalúa directamente la salida probabilística en lugar de depender solo de clasificaciones binarias por umbral.

Las principales métricas del clasificador son:

* ROC-AUC
* Brier score
* Brier score del baseline
* Comportamiento de calibración

## ROC-AUC: ¿puede el modelo ordenar el riesgo?

ROC-AUC mide hasta qué punto el modelo separa facturas tardías de facturas pagadas a tiempo a través de todos los umbrales posibles.

Una interpretación intuitiva es:

> Si selecciono aleatoriamente una factura tardía y una puntual, ¿con qué frecuencia asigna el modelo un riesgo mayor a la tardía?

Un valor cercano a:

* `0.50` indica un ranking aleatorio
* `1.00` indica un ranking perfecto

```python
from sklearn.metrics import roc_auc_score

roc_auc = roc_auc_score(
    y_test,
    late_probabilities,
)
```

ROC-AUC es útil porque los equipos de cobro normalmente parten de un problema de ranking. Quieren las facturas de mayor riesgo cerca de la parte superior de la cola.

Sin embargo, ROC-AUC no dice si los valores de probabilidad son fiables.

Un modelo podría ordenar las facturas correctamente mientras asigna probabilidades sistemáticamente demasiado altas o demasiado bajas.

## Calibración de probabilidades

Un modelo calibrado produce probabilidades que se corresponden con las frecuencias observadas.

Entre las facturas a las que se asigna un riesgo cercano al 20%, aproximadamente un 20% deberían terminar pagándose tarde.

Entre las facturas con un riesgo cercano al 80%, aproximadamente un 80% deberían terminar pagándose tarde.

La calibración importa porque Payrithm utiliza probabilidades en decisiones posteriores. Una puntuación de `0.80` debe representar algo más que «riesgo alto»: debe aproximarse a una probabilidad del evento del 80%.

Se puede generar una tabla de calibración con scikit-learn:

```python
from sklearn.calibration import calibration_curve

observed_rate, predicted_rate = calibration_curve(
    y_test,
    late_probabilities,
    n_bins=10,
    strategy="quantile",
)

calibration_table = pd.DataFrame(
    {
        "mean_predicted_probability": predicted_rate,
        "observed_late_rate": observed_rate,
    }
)

print(calibration_table)
```

En un modelo perfectamente calibrado, las columnas predicha y observada serían iguales.

En la práctica, inspecciono si el modelo:

* Subestima el riesgo en facturas de alto riesgo
* Sobreestima el riesgo en facturas de bajo riesgo
* Concentra las probabilidades en un rango estrecho
* Presenta calibración inestable en periodos con pocos datos

Cuando hace falta mejorar la calibración, debe hacerse con un periodo de calibración cronológico, no con folds mezclados aleatoriamente que rompen la estructura temporal.

## Brier score: medir la calidad de la probabilidad

El Brier score mide la diferencia cuadrática media entre probabilidades predichas y resultados reales:

$$
\text{Brier Score}
=
\frac{1}{N}
\sum_{i=1}^{N}
(p_i-y_i)^2
$$

donde:

* $(p_i)$ es la probabilidad predicha de pago tardío
* $(y_i)$ es el resultado binario real

Los valores menores son mejores.

```python
from sklearn.metrics import brier_score_loss

brier = brier_score_loss(
    y_test,
    late_probabilities,
)
```

El Brier score penaliza fuertemente los errores con mucha confianza.

Considera dos facturas que finalmente se pagan tarde:

| Resultado real | Predicción | Error cuadrático |
| --- | ---: | ---: |
| Tarde | 0.90 | 0.01 |
| Tarde | 0.10 | 0.81 |

La segunda predicción no solo está mal ordenada. Está equivocada con mucha confianza.

Esto hace que el Brier score sea especialmente útil en sistemas donde las probabilidades influyen en decisiones financieras.

## Comparar siempre contra un baseline

Una métrica tiene poco significado sin un punto de referencia.

El baseline probabilístico más sencillo predice la tasa de pagos tardíos del conjunto de entrenamiento para cada factura de evaluación.

```python
import numpy as np

training_late_rate = y_train.mean()

baseline_probabilities = np.full(
    shape=len(y_test),
    fill_value=training_late_rate,
    dtype=float,
)

baseline_brier = brier_score_loss(
    y_test,
    baseline_probabilities,
)
```

El clasificador debería obtener un Brier score inferior a este baseline en el conjunto de evaluación cronológica.

Payrithm registra métricas como:

```python
training_metrics = {
    "classifier_roc_auc": roc_auc,
    "classifier_brier": brier,
    "classifier_baseline_brier": baseline_brier,
}
```

Un modelo no se promociona simplemente porque el entrenamiento haya terminado correctamente. Debe demostrar valor respecto a un baseline cronológico.

Esa puerta de despliegue evita que un modelo recién entrenado pero más débil sustituya automáticamente al actual.

## El modelo complementario de retraso de pago

La probabilidad de pago tardío responde:

> ¿Es probable que esta factura se pague tarde?

No responde:

> Si se paga tarde, ¿cuánto retraso podría tener?

Por ello Payrithm entrena un segundo modelo con `GradientBoostingRegressor`.

Su variable objetivo es `delay_days` y su principal métrica de evaluación es el error absoluto medio:

$$
\text{MAE}
=
\frac{1}{N}
\sum_{i=1}^{N}
|\hat{y}_i-y_i|
$$

El baseline predice la mediana del retraso de entrenamiento para cada factura de evaluación.

```python
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error


payment_delay_model = Pipeline(
    steps=[
        ("preprocessor", preprocessor),
        (
            "regressor",
            GradientBoostingRegressor(
                random_state=42,
            ),
        ),
    ]
)

payment_delay_model.fit(
    X_train,
    train["delay_days"],
)

predicted_delay = payment_delay_model.predict(
    X_test
)

regressor_mae = mean_absolute_error(
    test["delay_days"],
    predicted_delay,
)

baseline_delay = train["delay_days"].median()

baseline_delay_predictions = np.full(
    len(test),
    baseline_delay,
)

baseline_mae = mean_absolute_error(
    test["delay_days"],
    baseline_delay_predictions,
)
```

El clasificador y el regresor aportan señales complementarias:

* Probabilidad de que la factura se pague tarde
* Retraso estimado respecto a su fecha de vencimiento

Más adelante, estas señales pueden apoyar la previsión de cobros y la planificación de cobro.

## De las predicciones a las prioridades de cobro

Una probabilidad alta de pago tardío no convierte automáticamente una factura en la máxima prioridad de cobro.

Considera dos facturas:

| Factura | Probabilidad de retraso | Importe | Vencimiento |
| --- | ---: | ---: | --- |
| A | 90% | $150 | En 25 días |
| B | 65% | $48,000 | Vencida |

Es más probable que la factura A se pague tarde, pero la B puede requerir atención inmediata por su valor y urgencia.

Por ello Payrithm mantiene separada la predicción del modelo de la puntuación operativa de cobro.

La puntuación de prioridad combina:

* **45%** probabilidad de pago tardío
* **25%** percentil del importe dentro de la moneda
* **25%** urgencia de vencimiento
* **5%** presión de recordatorios

$$
\text{Priority}
=
0.45P(\text{late})
+
0.25A
+
0.25U
+
0.05R
$$

donde:

* $(P(\text{late}))$ es la probabilidad del modelo
* $(A)$ es el percentil del importe dentro de la moneda
* $(U)$ es la urgencia normalizada del vencimiento
* $(R)$ es la presión normalizada de recordatorios

El siguiente código ilustra el cálculo:

```python
def add_collection_priority(
    open_invoices: pd.DataFrame,
    as_of_date: pd.Timestamp,
) -> pd.DataFrame:
    ranked = open_invoices.copy()

    ranked["amount_percentile"] = (
        ranked.groupby("currency")["amount"]
        .rank(method="average", pct=True)
    )

    days_to_due = (
        ranked["due_date"] - as_of_date
    ).dt.days

    # An invoice due in 30 days has low urgency.
    # An invoice due today or overdue approaches 1.
    ranked["due_date_urgency"] = np.clip(
        (30 - days_to_due) / 30,
        0,
        1,
    )

    ranked["reminder_pressure"] = np.clip(
        ranked["reminders_sent"]
        .fillna(0)
        .astype(float)
        / 3,
        0,
        1,
    )

    ranked["collection_priority"] = (
        0.45 * ranked["late_probability"]
        + 0.25 * ranked["amount_percentile"]
        + 0.25 * ranked["due_date_urgency"]
        + 0.05 * ranked["reminder_pressure"]
    )

    return ranked.sort_values(
        "collection_priority",
        ascending=False,
    )
```

Las funciones de normalización pueden ajustarse a la política de cobro de la organización. La decisión arquitectónica importante es que la fórmula siga siendo comprensible.

Un responsable de cobros debería poder ver por qué una factura aparece cerca de la parte superior:

* Riesgo predicho alto de pago tardío
* Valor relativo alto de la factura
* Vence pronto o ya está vencida
* Múltiples recordatorios anteriores

El ranking no se presenta como un misterioso segundo modelo de machine learning. Es una regla de negocio explícita construida alrededor de una predicción del modelo.

## Por qué importa esta separación

Mantener separadas la predicción de probabilidad y la priorización de cobro aporta varios beneficios.

### La predicción conserva la validez temporal

El clasificador solo utiliza información del momento de emisión. Los campos operativos en vivo no contaminan la evaluación del modelo.

### La política de negocio sigue siendo ajustable

Una empresa puede cambiar los pesos de prioridad sin volver a entrenar el clasificador.

Por ejemplo, podría aumentar el componente de importe durante una falta de liquidez o aumentar la urgencia cerca del final de un periodo de reporting.

### La cola es más fácil de explicar

Los usuarios pueden entender la contribución del riesgo, el valor, la urgencia y la actividad de recordatorios.

### La monitorización del modelo sigue siendo significativa

El clasificador puede evaluarse frente a resultados reales de pago tardío sin confundir la calidad del modelo con las reglas del workflow posterior.

## Monitorización del modelo después del despliegue

Una evaluación histórica satisfactoria no garantiza un rendimiento permanente.

El comportamiento de clientes, las políticas de pago, los mercados y la composición de facturas pueden cambiar.

Por ello Payrithm trata las métricas del modelo como registros de entrenamiento, no como resultados puntuales de un notebook.

Cada ejecución de entrenamiento puede registrar:

* Límites del periodo de entrenamiento
* Límites del periodo de evaluación
* Número de facturas resueltas
* Prevalencia de pagos tardíos
* ROC-AUC del clasificador
* Brier score del clasificador
* Brier score del baseline del clasificador
* MAE del regresor
* MAE del baseline del regresor
* Versiones de características y modelo

Con el tiempo, la aplicación puede comparar los resultados actuales con las predicciones realizadas originalmente.

Preguntas importantes de monitorización incluyen:

* ¿Ha cambiado la tasa observada de pagos tardíos?
* ¿Siguen calibradas las probabilidades predichas?
* ¿Está empeorando el Brier score?
* ¿Ha dejado el modelo de superar su baseline?
* ¿Están cambiando los importes de factura o los plazos de pago?
* ¿Se hacen más predicciones para clientes sin historial?
* ¿Ha cambiado la distribución de monedas o industrias?

El reentrenamiento debe estar impulsado por evidencia, no únicamente por un calendario arbitrario.

## Lecciones aprendidas

Construir el predictor de Payrithm reforzó varias lecciones que se aplican mucho más allá de los datos de facturas.

### La validez temporal importa más que unas métricas impresionantes

Una puntuación cronológica más baja pero honesta es más valiosa que una puntuación inflada por una división aleatoria.

### El historial del cliente debe reconstruirse

Agregar todo el historial de un cliente es fácil. Reconstruir qué se conocía realmente en cada fecha de predicción es la verdadera tarea de modelado.

### El ranking y la calidad de probabilidad son diferentes

ROC-AUC mide si las facturas arriesgadas suben a la parte superior. No garantiza que un riesgo predicho del 80% se comporte realmente como un 80%.

### Los baselines forman parte del modelo

Un modelo no debe desplegarse solo porque sea más sofisticado que una predicción constante. Debe demostrar que mejora esa predicción constante.

### Las predicciones necesitan una capa operativa

Una probabilidad solo se vuelve útil cuando se conecta con el valor de la factura, la urgencia y el workflow de cobro.

### La explicabilidad puede empezar en el diseño del sistema

No toda explicación requiere un algoritmo complejo de atribución. Separar el riesgo del modelo de los pesos explícitos de negocio ya hace que el resultado sea sustancialmente más fácil de entender.

## Pipeline final

El flujo completo de modelado de Payrithm puede resumirse así:

```text
CSV invoice import
        ↓
Schema and business-rule validation
        ↓
Target creation for resolved invoices
        ↓
Issue-time feature reconstruction
        ↓
Chronological train/test split
        ↓
Scikit-learn preprocessing pipeline
        ↓
Gradient boosting classifier and regressor
        ↓
ROC-AUC, Brier score, calibration, and MAE
        ↓
Comparison against chronological baselines
        ↓
Model promotion
        ↓
Predictions for open invoices
        ↓
Risk + value + urgency + reminder pressure
        ↓
Prioritized collection queue
```

El clasificador en sí es solo una parte de la solución.

El trabajo más importante está en definir cuándo ocurre la predicción, reconstruir la información disponible en ese momento, evaluar las probabilidades honestamente y convertir la salida en una decisión sobre la que alguien pueda actuar.

Esa es la diferencia entre entrenar un clasificador de facturas y construir un producto de predicción de pagos tardíos.
