---
title: "Feature engineering per a machine learning: tècniques pràctiques"
description: "L'ofici sovint ignorat de transformar dades brutes en variables informatives: encoding, escalat, valors absents, interaccions i selecció de variables."
date: 2026-05-20
lang: ca
translationKey: feature-engineering-ml
tags: ["Feature Engineering", "Machine Learning", "Scikit-learn", "Data Science"]
draft: false
---

## Per què importa el feature engineering

Un model només pot ser tan bo com la informació que rep. Les dades brutes rarament arriben en una forma que exposi l'estructura que necessita un algoritme. Un feature engineering ben pensat pot millorar el rendiment més que substituir un random forest per gradient boosting, perquè incorpora coneixement de domini directament a l'espai d'entrada.

Fins i tot amb deep learning, les dades tabulars continuen beneficiant-se enormement de variables construïdes manualment. Les xarxes neuronals per a dades tabulars acostumen a rendir pitjor que arbres amb gradient boosting (XGBoost, LightGBM) quan les variables no s'han treballat.

## Gestió de valors absents

Els valors absents s'han de tractar abans d'entrenar la majoria de models. L'estratègia adequada depèn de per què falten les dades:

| Mecanisme | Descripció | Estratègia |
|---|---|---|
| MCAR | Absència completament aleatòria | Imputació amb mitjana/mediana segura |
| MAR | L'absència depèn de dades observades | Imputació basada en models |
| MNAR | L'absència depèn del mateix valor que falta | Indicador + imputació, investigar amb cura |

Afegeix sempre una variable **indicadora d'absència** quan el fet que falti un valor contingui informació:

```python
from sklearn.impute import SimpleImputer
import numpy as np

# Add binary indicator columns before imputing
df["age_missing"] = df["age"].isna().astype(int)
imputer = SimpleImputer(strategy="median")
df["age"] = imputer.fit_transform(df[["age"]])
```

## Codificació de variables categòriques

Les variables categòriques s'han de convertir a representacions numèriques. L'elecció depèn de la cardinalitat:

**Ordinal encoding** — per a variables de baixa cardinalitat amb ordre natural:
```python
from sklearn.preprocessing import OrdinalEncoder
enc = OrdinalEncoder(categories=[["low", "medium", "high"]])
```

**One-hot encoding** — per a variables nominals de baixa cardinalitat (< ~15 categories):
```python
from sklearn.preprocessing import OneHotEncoder
enc = OneHotEncoder(sparse_output=False, handle_unknown="ignore")
```

**Target encoding** — per a variables d'alta cardinalitat. Substitueix cada categoria per la mitjana de l'objectiu d'aquella categoria, estimada amb validació creuada per evitar leakage:

$$\hat{x}_i = \frac{\sum_{j \neq i} \mathbf{1}[x_j = x_i] \cdot y_j + \alpha \bar{y}}{\sum_{j \neq i} \mathbf{1}[x_j = x_i] + \alpha}$$

on $\alpha$ és un factor de suavitzat que porta les estimacions de categories rares cap a la mitjana global.

## Transformacions numèriques

Les variables numèriques brutes sovint tenen distribucions poc adequades per a models lineals o algoritmes basats en distàncies.

**Estandardització** — mitjana zero, variància unitària:

$$z = \frac{x - \mu}{\sigma}$$

**Escalat min-max** — transforma a $[0, 1]$:

$$z = \frac{x - x_{min}}{x_{max} - x_{min}}$$

**Transformació logarítmica** — comprimeix distribucions esbiaixades a la dreta:

$$z = \log(1 + x)$$

És útil per ingressos, recomptes o preus: qualsevol variable amb una cua dreta pesada.

**Transformació Box-Cox** — generalitza el logaritme amb un $\lambda$ après:

$$z = \begin{cases} \frac{x^\lambda - 1}{\lambda} & \lambda \neq 0 \\ \log x & \lambda = 0 \end{cases}$$

```python
from sklearn.preprocessing import PowerTransformer
pt = PowerTransformer(method="box-cox")  # requires x > 0
```

## Variables de data i hora

Les columnes datetime codifiquen informació cíclica rica que s'ha d'extreure explícitament:

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

La codificació cíclica (sin/cos) assegura que l'hora 23 quedi a prop de l'hora 0 a l'espai de variables, cosa que un enter brut no representa.

## Variables d'interacció

En models lineals, les interaccions entre variables s'han de crear explícitament:

$$x_{12} = x_1 \cdot x_2$$

```python
from sklearn.preprocessing import PolynomialFeatures
poly = PolynomialFeatures(degree=2, interaction_only=True, include_bias=False)
X_interactions = poly.fit_transform(X)
```

Els models basats en arbres descobreixen interaccions automàticament, però continuen beneficiant-se de ràtios i diferències ben construïdes:

```python
df["price_per_sqft"] = df["price"] / (df["sqft"] + 1)
df["age_since_renovation"] = df["year"] - df["last_renovation_year"]
```

## Selecció de variables

Afegir massa variables perjudica la generalització —la maledicció de la dimensionalitat— i alenteix l'entrenament. Estratègies habituals:

**Llindar de variància** — elimina variables gairebé constants:
```python
from sklearn.feature_selection import VarianceThreshold
sel = VarianceThreshold(threshold=0.01)
```

**Informació mútua** — mesura dependències no lineals entre variable i objectiu:
```python
from sklearn.feature_selection import SelectKBest, mutual_info_classif
sel = SelectKBest(mutual_info_classif, k=20)
```

**Permutation importance** — entrena el model i mesura quant cau el rendiment quan cada variable es barreja aleatòriament:
```python
from sklearn.inspection import permutation_importance
result = permutation_importance(model, X_val, y_val, n_repeats=10)
```

**Valors SHAP** — atribució agnòstica al model i fonamentada teòricament en els valors de Shapley. És una de les referències per a selecció de variables en producció.

## Construir un pipeline de preprocessament

Utilitza `sklearn.pipeline.Pipeline` per encadenar transformacions de forma segura i evitar leakage entre train i test:

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

Totes les estadístiques de transformació —mitjanes, codificacions, etc.— s'ajusten només sobre `X_train` i després s'apliquen a `X_val`/`X_test`.

## Idees clau

- En dades tabulars, el feature engineering sovint té més impacte que l'elecció del model
- Afegeix indicadors d'absència quan el fet que falti una dada contingui senyal
- Utilitza codificació cíclica (sin/cos) per a variables periòdiques com hora, dia o mes
- Aplica target encoding a categòriques d'alta cardinalitat amb validació creuada per evitar leakage
- Encapsula tot el preprocessament en un `Pipeline` per garantir una separació correcta entre train i test
- Utilitza permutation importance o valors SHAP per eliminar variables irrellevants
