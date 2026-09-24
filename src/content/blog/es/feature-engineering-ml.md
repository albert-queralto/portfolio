---
title: "Feature engineering para machine learning: técnicas prácticas"
description: "El trabajo a menudo ignorado de transformar datos brutos en variables informativas: encoding, escalado, valores ausentes, interacciones y selección de variables."
date: 2026-05-20
lang: es
translationKey: feature-engineering-ml
tags: ["Feature Engineering", "Machine Learning", "Scikit-learn", "Data Science"]
draft: false
---

## Por qué importa el feature engineering

Un modelo solo puede ser tan bueno como la información que recibe. Los datos brutos rara vez llegan en una forma que exponga la estructura que necesita un algoritmo. Un feature engineering cuidadoso puede mejorar el rendimiento más que cambiar un random forest por gradient boosting, porque codifica conocimiento de dominio directamente en el espacio de entrada.

Incluso con deep learning, los datos tabulares siguen beneficiándose enormemente de variables construidas manualmente. Las redes neuronales para datos tabulares suelen rendir peor que los árboles con gradient boosting (XGBoost, LightGBM) cuando las variables no están trabajadas.

## Gestión de valores ausentes

Los valores ausentes deben tratarse antes de entrenar la mayoría de modelos. La estrategia adecuada depende de por qué faltan los datos:

| Mecanismo | Descripción | Estrategia |
|---|---|---|
| MCAR | Ausencia completamente aleatoria | Imputación con media/mediana segura |
| MAR | La ausencia depende de datos observados | Imputación basada en modelos |
| MNAR | La ausencia depende del propio valor ausente | Indicador + imputación, investigar cuidadosamente |

Añade siempre una variable **indicadora de ausencia** cuando el hecho de que falte un valor contenga señal:

```python
from sklearn.impute import SimpleImputer
import numpy as np

# Add binary indicator columns before imputing
df["age_missing"] = df["age"].isna().astype(int)
imputer = SimpleImputer(strategy="median")
df["age"] = imputer.fit_transform(df[["age"]])
```

## Codificación de variables categóricas

Las variables categóricas deben convertirse en representaciones numéricas. La elección depende de la cardinalidad:

**Ordinal encoding** — para variables de baja cardinalidad con orden natural:
```python
from sklearn.preprocessing import OrdinalEncoder
enc = OrdinalEncoder(categories=[["low", "medium", "high"]])
```

**One-hot encoding** — para nominales de baja cardinalidad (< ~15 categorías):
```python
from sklearn.preprocessing import OneHotEncoder
enc = OneHotEncoder(sparse_output=False, handle_unknown="ignore")
```

**Target encoding** — para variables de alta cardinalidad. Sustituye cada categoría por el valor medio del objetivo de esa categoría, estimado mediante validación cruzada para evitar leakage:

$$\hat{x}_i = \frac{\sum_{j \neq i} \mathbf{1}[x_j = x_i] \cdot y_j + \alpha \bar{y}}{\sum_{j \neq i} \mathbf{1}[x_j = x_i] + \alpha}$$

donde $\alpha$ es un factor de suavizado que acerca las estimaciones de categorías raras a la media global.

## Transformaciones numéricas

Las variables numéricas brutas suelen presentar distribuciones poco adecuadas para modelos lineales o algoritmos basados en distancias.

**Estandarización** — media cero, varianza unitaria:

$$z = \frac{x - \mu}{\sigma}$$

**Escalado min-max** — transforma a $[0, 1]$:

$$z = \frac{x - x_{min}}{x_{max} - x_{min}}$$

**Transformación logarítmica** — comprime distribuciones sesgadas a la derecha:

$$z = \log(1 + x)$$

Resulta útil para ingresos, recuentos o precios: cualquier variable con una cola derecha pesada.

**Transformación Box-Cox** — generaliza el logaritmo con un $\lambda$ aprendido:

$$z = \begin{cases} \frac{x^\lambda - 1}{\lambda} & \lambda \neq 0 \\ \log x & \lambda = 0 \end{cases}$$

```python
from sklearn.preprocessing import PowerTransformer
pt = PowerTransformer(method="box-cox")  # requires x > 0
```

## Variables de fecha y hora

Las columnas datetime codifican información cíclica rica que debe extraerse explícitamente:

```python
df["hour"] = df["timestamp"].dt.hour
df["day_of_week"] = df["timestamp"].dt.dayofweek
df["month"] = df["timestamp"].dt.month
df["is_weekend"] = (df["day_of_week"] >= 5).astype(int)

# Cyclical encoding for periodic features
import numpy as np
df["hour_sin"] = np.sin(2 * np.pi * df["hour"] / 24)
df["hour_cos"] = np.cos(2 * np.pi * df["hour"] / 24)
```

La codificación cíclica (sin/cos) asegura que la hora 23 esté cerca de la hora 0 en el espacio de variables, algo que un entero bruto no representa.

## Variables de interacción

En modelos lineales, las interacciones entre variables deben crearse explícitamente:

$$x_{12} = x_1 \cdot x_2$$

```python
from sklearn.preprocessing import PolynomialFeatures
poly = PolynomialFeatures(degree=2, interaction_only=True, include_bias=False)
X_interactions = poly.fit_transform(X)
```

Los modelos basados en árboles descubren interacciones automáticamente, pero siguen beneficiándose de ratios y diferencias bien construidas:

```python
df["price_per_sqft"] = df["price"] / (df["sqft"] + 1)
df["age_since_renovation"] = df["year"] - df["last_renovation_year"]
```

## Selección de variables

Añadir demasiadas variables perjudica la generalización —la maldición de la dimensionalidad— y ralentiza el entrenamiento. Estrategias habituales:

**Umbral de varianza** — elimina variables casi constantes:
```python
from sklearn.feature_selection import VarianceThreshold
sel = VarianceThreshold(threshold=0.01)
```

**Información mutua** — mide dependencia no lineal entre variable y objetivo:
```python
from sklearn.feature_selection import SelectKBest, mutual_info_classif
sel = SelectKBest(mutual_info_classif, k=20)
```

**Permutation importance** — entrena el modelo y mide cuánto cae el rendimiento al barajar aleatoriamente cada variable:
```python
from sklearn.inspection import permutation_importance
result = permutation_importance(model, X_val, y_val, n_repeats=10)
```

**Valores SHAP** — atribución agnóstica al modelo y fundamentada teóricamente en valores de Shapley. Es una referencia para selección de variables en producción.

## Construir un pipeline de preprocesamiento

Utiliza `sklearn.pipeline.Pipeline` para encadenar transformaciones de forma segura y evitar leakage entre train y test:

```python
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingClassifier

numeric_transformer = Pipeline([
    ("impute", SimpleImputer(strategy="median")),
    ("scale", PowerTransformer()),
])

categorical_transformer = Pipeline([
    ("impute", SimpleImputer(strategy="most_frequent")),
    ("encode", OneHotEncoder(handle_unknown="ignore")),
])

preprocessor = ColumnTransformer([
    ("num", numeric_transformer, numeric_cols),
    ("cat", categorical_transformer, categorical_cols),
])

model = Pipeline([
    ("preprocessor", preprocessor),
    ("classifier", GradientBoostingClassifier()),
])

model.fit(X_train, y_train)
```

Todas las estadísticas de transformación —medias, codificaciones, etc.— se ajustan únicamente sobre `X_train` y después se aplican a `X_val`/`X_test`.

## Ideas clave

- En datos tabulares, el feature engineering suele tener más impacto que la selección del modelo
- Añade indicadores de ausencia cuando el hecho de que falte un dato contenga señal
- Usa codificación cíclica (sin/cos) para variables periódicas como hora, día o mes
- Aplica target encoding a categóricas de alta cardinalidad con validación cruzada para evitar leakage
- Encapsula todo el preprocesamiento en un `Pipeline` para asegurar una separación correcta entre train y test
- Utiliza permutation importance o valores SHAP para eliminar variables irrelevantes
