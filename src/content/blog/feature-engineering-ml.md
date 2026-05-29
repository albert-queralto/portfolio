---
title: "Feature Engineering for Machine Learning: Practical Techniques"
description: "The often-overlooked craft of transforming raw data into informative features — covering encoding, scaling, missing values, interactions, and selection."
date: 2026-05-20
tags: ["Feature Engineering", "Machine Learning", "Scikit-learn", "Data Science"]
draft: false
---

## Why Feature Engineering Matters

A model is only as good as the information it receives. Raw data rarely arrives in a form that exposes the structure an algorithm needs. Thoughtful feature engineering can improve a model's performance more than switching from a random forest to gradient boosting — it encodes domain knowledge directly into the input space.

Even with deep learning, tabular data still benefits enormously from hand-crafted features. Neural networks for tabular data consistently underperform gradient-boosted trees (XGBoost, LightGBM) when features are not engineered.

## Handling Missing Values

Missing values must be addressed before most models can be trained. The right strategy depends on why data is missing:

| Mechanism | Description | Strategy |
|---|---|---|
| MCAR | Missing completely at random | Mean/median imputation safe |
| MAR | Missing depends on observed data | Model-based imputation |
| MNAR | Missing depends on the missing value itself | Flag + impute, investigate carefully |

Always add a **missingness indicator** feature when the fact that a value is missing carries signal:

```python
from sklearn.impute import SimpleImputer
import numpy as np

# Add binary indicator columns before imputing
df["age_missing"] = df["age"].isna().astype(int)
imputer = SimpleImputer(strategy="median")
df["age"] = imputer.fit_transform(df[["age"]])
```

## Encoding Categorical Variables

Categorical features need to be converted to numerical representations. The right choice depends on cardinality:

**Ordinal encoding** — for low-cardinality features with a natural order:
```python
from sklearn.preprocessing import OrdinalEncoder
enc = OrdinalEncoder(categories=[["low", "medium", "high"]])
```

**One-hot encoding** — for low-cardinality nominals (< ~15 categories):
```python
from sklearn.preprocessing import OneHotEncoder
enc = OneHotEncoder(sparse_output=False, handle_unknown="ignore")
```

**Target encoding** — for high-cardinality features. Replace each category with the mean target value for that category, estimated with cross-validation to avoid leakage:

$$\hat{x}_i = \frac{\sum_{j \neq i} \mathbf{1}[x_j = x_i] \cdot y_j + \alpha \bar{y}}{\sum_{j \neq i} \mathbf{1}[x_j = x_i] + \alpha}$$

where $\alpha$ is a smoothing factor that shrinks estimates toward the global mean for rare categories.

## Numerical Transformations

Raw numerical features often have distributions that are poorly suited to linear models or distance-based algorithms.

**Standardisation** — zero mean, unit variance:

$$z = \frac{x - \mu}{\sigma}$$

**Min-max scaling** — maps to $[0, 1]$:

$$z = \frac{x - x_{min}}{x_{max} - x_{min}}$$

**Log transform** — compresses right-skewed distributions:

$$z = \log(1 + x)$$

Useful for revenue, counts, prices — any feature with a heavy right tail.

**Box-Cox transform** — generalises log transform with a learned $\lambda$:

$$z = \begin{cases} \frac{x^\lambda - 1}{\lambda} & \lambda \neq 0 \\ \log x & \lambda = 0 \end{cases}$$

```python
from sklearn.preprocessing import PowerTransformer
pt = PowerTransformer(method="box-cox")  # requires x > 0
```

## Datetime Features

Datetime columns encode rich cyclical information that needs to be extracted explicitly:

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

Cyclical encoding (sin/cos) ensures that hour 23 is close to hour 0 in feature space, which a raw integer would not capture.

## Interaction Features

For linear models, interactions between features must be created explicitly:

$$x_{12} = x_1 \cdot x_2$$

```python
from sklearn.preprocessing import PolynomialFeatures
poly = PolynomialFeatures(degree=2, interaction_only=True, include_bias=False)
X_interactions = poly.fit_transform(X)
```

Tree-based models discover interactions automatically but still benefit from well-constructed ratio and difference features:

```python
df["price_per_sqft"] = df["price"] / (df["sqft"] + 1)
df["age_since_renovation"] = df["year"] - df["last_renovation_year"]
```

## Feature Selection

Adding too many features hurts generalisation (the curse of dimensionality) and slows training. Common selection strategies:

**Variance threshold** — remove near-constant features:
```python
from sklearn.feature_selection import VarianceThreshold
sel = VarianceThreshold(threshold=0.01)
```

**Mutual information** — measures non-linear dependency between feature and target:
```python
from sklearn.feature_selection import SelectKBest, mutual_info_classif
sel = SelectKBest(mutual_info_classif, k=20)
```

**Permutation importance** — train the model, then measure how much performance drops when each feature is randomly shuffled:
```python
from sklearn.inspection import permutation_importance
result = permutation_importance(model, X_val, y_val, n_repeats=10)
```

**SHAP values** — model-agnostic, theoretically grounded attribution based on Shapley values. The gold standard for production feature selection.

## Building a Preprocessing Pipeline

Use `sklearn.pipeline.Pipeline` to chain transformations safely — preventing train/test leakage:

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

All transformation statistics (means, encodings, etc.) are fitted on `X_train` only and applied to `X_val`/`X_test`.

## Key Takeaways

- Feature engineering is often more impactful than model selection for tabular data
- Always add missingness indicator features when missing data carries signal
- Use cyclical encoding (sin/cos) for periodic features like hour, day, month
- Target encode high-cardinality categoricals with cross-validation to prevent leakage
- Wrap all preprocessing in a `Pipeline` to ensure correct train/test separation
- Use permutation importance or SHAP values to prune irrelevant features
