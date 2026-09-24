---
title: "Feature Engineering für Machine Learning: praktische Techniken"
description: "Die oft unterschätzte Arbeit, Rohdaten in informative Features zu verwandeln – Encoding, Skalierung, fehlende Werte, Interaktionen und Feature-Auswahl."
date: 2026-05-20
lang: de
translationKey: feature-engineering-ml
tags: ["Feature Engineering", "Machine Learning", "Scikit-learn", "Data Science"]
draft: false
---

## Warum Feature Engineering wichtig ist

Ein Modell kann nur so gut sein wie die Information, die es erhält. Rohdaten liegen selten in einer Form vor, die die für einen Algorithmus relevante Struktur direkt sichtbar macht. Durchdachtes Feature Engineering kann die Modellleistung stärker verbessern als der Wechsel von Random Forest zu Gradient Boosting, weil Domänenwissen direkt in den Eingaberaum eingebaut wird.

Auch bei Deep Learning profitieren tabellarische Daten stark von konstruierten Features. Neuronale Netze für Tabellendaten schneiden ohne gutes Feature Engineering häufig schlechter ab als Gradient-Boosted Trees wie XGBoost oder LightGBM.

## Fehlende Werte behandeln

Fehlende Werte müssen vor dem Training der meisten Modelle behandelt werden. Die richtige Strategie hängt davon ab, warum Daten fehlen:

| Mechanismus | Beschreibung | Strategie |
|---|---|---|
| MCAR | Vollständig zufällig fehlend | Mittelwert-/Median-Imputation ist vertretbar |
| MAR | Fehlend abhängig von beobachteten Daten | Modellbasierte Imputation |
| MNAR | Fehlend abhängig vom fehlenden Wert selbst | Indikator + Imputation, sorgfältig untersuchen |

Füge immer ein **Missingness-Indikator-Feature** hinzu, wenn die Tatsache, dass ein Wert fehlt, selbst Information trägt:

```python
from sklearn.impute import SimpleImputer
import numpy as np

# Add binary indicator columns before imputing
df["age_missing"] = df["age"].isna().astype(int)
imputer = SimpleImputer(strategy="median")
df["age"] = imputer.fit_transform(df[["age"]])
```

## Kategoriale Variablen kodieren

Kategoriale Features müssen in numerische Repräsentationen umgewandelt werden. Die richtige Wahl hängt von der Kardinalität ab:

**Ordinal Encoding** — für Features mit niedriger Kardinalität und natürlicher Reihenfolge:
```python
from sklearn.preprocessing import OrdinalEncoder
enc = OrdinalEncoder(categories=[["low", "medium", "high"]])
```

**One-Hot Encoding** — für nominale Features mit niedriger Kardinalität (< ~15 Kategorien):
```python
from sklearn.preprocessing import OneHotEncoder
enc = OneHotEncoder(sparse_output=False, handle_unknown="ignore")
```

**Target Encoding** — für hochkardinale Features. Jede Kategorie wird durch den mittleren Zielwert dieser Kategorie ersetzt, geschätzt mit Cross-Validation, um Leakage zu vermeiden:

$$\hat{x}_i = \frac{\sum_{j \neq i} \mathbf{1}[x_j = x_i] \cdot y_j + \alpha \bar{y}}{\sum_{j \neq i} \mathbf{1}[x_j = x_i] + \alpha}$$

wobei $\alpha$ ein Glättungsfaktor ist, der Schätzungen seltener Kategorien in Richtung des globalen Mittelwerts zieht.

## Numerische Transformationen

Rohe numerische Features haben häufig Verteilungen, die für lineare Modelle oder distanzbasierte Algorithmen ungünstig sind.

**Standardisierung** — Mittelwert null, Varianz eins:

$$z = \frac{x - \mu}{\sigma}$$

**Min-Max-Skalierung** — Abbildung auf $[0, 1]$:

$$z = \frac{x - x_{min}}{x_{max} - x_{min}}$$

**Log-Transformation** — komprimiert rechtsschiefe Verteilungen:

$$z = \log(1 + x)$$

Nützlich für Umsatz, Zählwerte oder Preise — allgemein für Features mit schwerem rechten Rand.

**Box-Cox-Transformation** — verallgemeinert die Log-Transformation mit einem gelernten $\lambda$:

$$z = \begin{cases} \frac{x^\lambda - 1}{\lambda} & \lambda \neq 0 \\ \log x & \lambda = 0 \end{cases}$$

```python
from sklearn.preprocessing import PowerTransformer
pt = PowerTransformer(method="box-cox")  # requires x > 0
```

## Datums- und Zeitfeatures

Datetime-Spalten enthalten reichhaltige zyklische Information, die explizit extrahiert werden sollte:

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

Zyklisches Encoding (sin/cos) stellt sicher, dass Stunde 23 im Featureraum nahe bei Stunde 0 liegt, was ein roher Integer nicht abbildet.

## Interaktionsfeatures

Für lineare Modelle müssen Interaktionen zwischen Features explizit erzeugt werden:

$$x_{12} = x_1 \cdot x_2$$

```python
from sklearn.preprocessing import PolynomialFeatures
poly = PolynomialFeatures(degree=2, interaction_only=True, include_bias=False)
X_interactions = poly.fit_transform(X)
```

Baumbasierte Modelle entdecken Interaktionen automatisch, profitieren aber weiterhin von sinnvoll konstruierten Verhältnis- und Differenzfeatures:

```python
df["price_per_sqft"] = df["price"] / (df["sqft"] + 1)
df["age_since_renovation"] = df["year"] - df["last_renovation_year"]
```

## Feature-Auswahl

Zu viele Features verschlechtern die Generalisierung — der Fluch der Dimensionalität — und verlangsamen das Training. Häufige Strategien:

**Varianzschwelle** — entfernt nahezu konstante Features:
```python
from sklearn.feature_selection import VarianceThreshold
sel = VarianceThreshold(threshold=0.01)
```

**Mutual Information** — misst nichtlineare Abhängigkeit zwischen Feature und Ziel:
```python
from sklearn.feature_selection import SelectKBest, mutual_info_classif
sel = SelectKBest(mutual_info_classif, k=20)
```

**Permutation Importance** — Modell trainieren und messen, wie stark die Leistung sinkt, wenn jedes Feature zufällig permutiert wird:
```python
from sklearn.inspection import permutation_importance
result = permutation_importance(model, X_val, y_val, n_repeats=10)
```

**SHAP-Werte** — modellagnostische, theoretisch auf Shapley-Werten basierende Attribution. Eine wichtige Referenz für Feature-Auswahl in Produktionssystemen.

## Eine Preprocessing-Pipeline bauen

Nutze `sklearn.pipeline.Pipeline`, um Transformationen sicher zu verketten und Train/Test-Leakage zu verhindern:

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

Alle Transformationsstatistiken — Mittelwerte, Encodings usw. — werden ausschließlich auf `X_train` angepasst und anschließend auf `X_val`/`X_test` angewendet.

## Wichtigste Erkenntnisse

- Bei tabellarischen Daten ist Feature Engineering oft wirkungsvoller als Modellauswahl
- Missingness-Indikatoren hinzufügen, wenn fehlende Daten selbst Signal tragen
- Zyklisches Encoding (sin/cos) für periodische Features wie Stunde, Tag und Monat verwenden
- Hochkardinale Kategorien mit Cross-Validation target-encoden, um Leakage zu vermeiden
- Sämtliches Preprocessing in eine `Pipeline` kapseln, um Train/Test-Trennung sicherzustellen
- Permutation Importance oder SHAP-Werte nutzen, um irrelevante Features zu entfernen
