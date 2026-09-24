---
title: "Construint un predictor de retard en el pagament de factures amb Python i Scikit-learn"
description: "Com vaig dissenyar el pipeline de machine learning de Payrithm per predir pagaments tardans sense fuga de dades, avaluar la qualitat de les probabilitats i convertir les prediccions en prioritats de cobrament accionables."
date: 2026-07-25
lang: ca
translationKey: payrithm
tags: ["Machine Learning", "Scikit-learn", "Python", "Fintech", "MLOps"]
draft: false
cover: "/og/invoice-late-payment-predictor.png"
featured: true
project: "payrithm"
---

Predir si una factura es pagarà tard sembla un problema senzill de classificació binària:

* `0`: la factura es paga a temps
* `1`: la factura es paga tard

La part difícil no és entrenar un classificador. La part difícil és construir un sistema de predicció que reflecteixi què es coneixeria realment quan es crea una factura nova.

Un model pot semblar molt precís mentre utilitza accidentalment informació de pagament procedent del futur. Pot ordenar factures per risc sense produir probabilitats fiables. També pot generar prediccions tècnicament correctes que mai no es converteixen en decisions de cobrament útils.

Aquests són els problemes que volia resoldre mentre construïa **Payrithm**, una aplicació d'intel·ligència de comptes a cobrar que prediu pagaments tardans, estima el moment del pagament, prioritza cobraments i pronostica entrades de caixa.

En aquest article recorro tot el procés de modelatge:

1. Definir el problema de negoci
2. Preparar les dades de factures
3. Evitar la fuga temporal de dades
4. Crear característiques d'historial de client
5. Crear una divisió train/test cronològica
6. Avaluar el rànquing i la qualitat de les probabilitats
7. Convertir les prediccions en prioritats de cobrament

Els exemples utilitzen Python, pandas i scikit-learn. Els mateixos principis són aplicables a molts sistemes de predicció reals que involucren clients, transaccions i comportaments dependents del temps.

## El problema de negoci

Els equips de comptes a cobrar poques vegades tenen prou temps per tractar totes les factures pendents de la mateixa manera.

Una empresa pot tenir centenars o milers de factures obertes. Algunes es pagaran sense intervenció. D'altres requeriran recordatoris, trucades, resolució de disputes o escalat.

Per tant, la pregunta operativa no és simplement:

> Quines factures estan pendents de pagament?

Les preguntes més útils són:

* Quines factures acabades d'emetre és probable que es paguin tard?
* Quant de temps després del venciment podria arribar el pagament?
* Quines factures pendents mereixen atenció primer?
* Quanta caixa és probable que entri durant les pròximes setmanes?

Payrithm aborda el problema amb dos models de machine learning relacionats:

* Un **classificador** que estima la probabilitat de pagament tardà
* Un **regressor** que estima el retard del pagament respecte de la data de venciment

Aquest article se centra principalment en el classificador.

Per a una factura (i), el classificador estima:

$$
P(Y_i = 1 \mid X_i)
$$

on:

* $(Y_i = 1)$ significa que la factura finalment es paga després del venciment
* $(X_i)$ conté informació disponible quan s'emet la factura

Aquesta última condició és essencial.

El model està pensat per fer una **predicció en el moment d'emissió**. Ha de comportar-se com si s'executés el dia que es crea la factura, no diverses setmanes després, quan els recordatoris, les disputes, els dies de retard i el resultat final del pagament ja són coneguts.

## Definició de la variable objectiu

Per a les factures resoltes, l'etiqueta de pagament tardà es pot derivar comparant la data de pagament amb la data de venciment:

$$
\text{paid\_late} =
\begin{cases}
1 & \text{si paid\_date} > \text{due\_date} \\
0 & \text{en cas contrari}
\end{cases}
$$

La variable objectiu de retard utilitzada pel model de regressió complementari és:

$$
\text{delay\_days} =
\text{paid\_date} - \text{due\_date}
$$

Un valor negatiu significa que la factura es va pagar abans d'hora. Zero significa que es va pagar el mateix dia del venciment. Un valor positiu representa el nombre de dies de retard.

Les factures no resoltes encara no tenen un resultat final, per tant no es poden utilitzar com a exemples supervisats d'entrenament. Sí que es poden puntuar després d'haver entrenat el model.

## Preparació de les dades de factures

Payrithm importa dades de factures des de fitxers CSV.

Els camps mínims requerits són:

| Camp | Descripció |
| --- | --- |
| `invoice_id` | Identificador únic de la factura |
| `customer_id` | Identificador del client |
| `issue_date` | Data d'emissió de la factura |
| `due_date` | Data límit contractual de pagament |
| `amount` | Import de la factura |

El sistema també pot utilitzar camps opcionals com:

* `paid_date`
* `currency`
* `customer_industry`
* `disputed`
* `dispute_opened_date`
* `reminders_sent`
* `last_reminder_date`

El primer pas de preparació consisteix a validar tipus, dates, identificadors i regles bàsiques de negoci.

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

La validació en producció requereix més que comprovar valors absents.

Per exemple, també vull detectar:

* Dates de pagament anteriors a les dates d'emissió
* Terminis de pagament inesperadament grans o negatius
* Monedes desconegudes
* Identificadors de factura duplicats
* Canvis sobtats d'esquema
* Imports mal formats o escalats incorrectament
* Valors categòrics amb ortografia inconsistent

Aquestes comprovacions eviten que els errors de qualitat de dades es converteixin silenciosament en comportament del model.

## No combinar mai imports de monedes diferents

Una factura de `10,000 USD` no s'ha de comparar directament amb una de `10,000 EUR`, `10,000 GBP` o `10,000 MXN`.

Per això Payrithm evita agregar o ordenar imports bruts de factures entre monedes diferents.

Per prioritzar cobraments, l'import de la factura es converteix en un percentil dins de la seva pròpia moneda:

```python
invoices["amount_percentile"] = (
    invoices.groupby("currency")["amount"]
    .rank(method="average", pct=True)
)
```

Això no fa conversió de divises, però proporciona un senyal relatiu útil:

> Com de gran és aquesta factura en comparació amb altres factures de la mateixa moneda?

Un sistema de producció també podria convertir imports utilitzant una font fiable de tipus de canvi, però això introdueix preguntes addicionals sobre la data del canvi, la política comptable i la reproductibilitat.

## El problema més perillós: la fuga de dades

La fuga de dades es produeix quan l'entrenament utilitza informació que no hauria estat disponible en el moment de la predicció.

En predicció de factures és especialment fàcil introduir-la perquè el dataset normalment s'extreu després que moltes factures ja s'hagin pagat.

Considera un model entrenat amb aquestes columnes:

* `paid_date`
* `days_overdue`
* `reminders_sent`
* `last_reminder_date`
* `disputed`
* Percentatge de pagaments tardans del client calculat amb totes les factures

Les mètriques resultants podrien semblar excel·lents. El model podria haver rebut indirectament la resposta.

### Informació que no pot entrar en un model del moment d'emissió

| Camp o característica | Per què produeix fuga |
| --- | --- |
| `paid_date` | Revela directament el resultat final |
| `delay_days` | Es deriva de la variable objectiu |
| `paid_late` | És l'objectiu de classificació |
| Dies de retard actuals | Una factura nova no està vençuda quan s'emet |
| Recordatoris futurs | Es produeixen després de la data de predicció |
| Estat final de disputa | La disputa es pot haver obert després de l'emissió |
| Taxa històrica completa de retard del client | Pot incloure factures resoltes en el futur |
| Preprocessament ajustat sobre totes les dades | Exposa estadístiques del conjunt d'avaluació |

La pregunta guia per a cada característica candidata és:

> Hauria pogut calcular aquest valor al final de la data d'emissió de la factura?

Si la resposta és no, la característica no pertany al model de predicció en el moment d'emissió.

## Les característiques de predicció i les operatives són diferents

Payrithm separa dos conceptes que sovint es barregen incorrectament.

### Característiques de predicció en el moment d'emissió

Són les que utilitza el model de machine learning:

* Import de la factura
* Moneda
* Terminis de pagament
* Mes d'emissió
* Dia de la setmana d'emissió
* Indústria del client
* Comportament del client conegut abans de l'emissió
* Si existeix prou historial del client

### Característiques operatives en viu

Es poden utilitzar més endavant per ordenar les factures actualment obertes:

* Dies fins al venciment
* Si la factura ja està vençuda
* Nombre de recordatoris enviats
* Temps des de l'últim recordatori
* Estat actual de la disputa
* Estat actual de la factura

Els senyals operatius en viu són útils per prendre decisions de cobrament, però no es poden presentar al model com si fossin coneguts en el moment d'emissió.

Mantenir separades la predicció i la priorització fa que el sistema sigui més fàcil de raonar i avaluar.

## Enginyeria de característiques de l'historial del client

El comportament de pagament anterior d'un client és una de les fonts d'informació predictiva més útils.

Les característiques històriques potencials inclouen:

* Nombre de factures resoltes anteriorment
* Taxa històrica de pagaments tardans
* Retard mitjà respecte al venciment
* Retard històric màxim
* Mitjana de dies entre emissió i pagament
* Si el client té historial utilitzable

La implementació ingènua seria:

```python
invoices.groupby("customer_id")["paid_late"].mean()
```

Aquest càlcul no és segur.

Utilitza tot l'historial del client, incloses factures emeses i pagades després de la factura que s'està modelant.

En lloc d'això, cada factura necessita una fotografia històrica reconstruïda en la seva data d'emissió.

Per a una factura emesa en el temps (t), una factura anterior només és elegible per a les característiques d'historial resolt quan:

1. Pertany al mateix client
2. Es va emetre abans de (t)
3. El seu resultat de pagament era conegut abans de (t)

La tercera condició és important. Una factura anterior podria existir a (t), però si encara estava pendent, el seu resultat eventual encara no es coneixia.

La implementació següent prioritza la claredat per sobre del màxim rendiment:

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

Aquesta implementació fa filtratges repetits i es tornarà lenta amb datasets molt grans. En producció, la mateixa lògica es pot implementar de manera més eficient amb processament cronològic d'esdeveniments, agregacions expansives o operacions de finestra a la base de dades.

La part important és la regla temporal, no la implementació exacta.

## Tractament de clients nous

Un client nou pot no tenir cap historial de factures resoltes.

És un problema clàssic de cold start.

Eliminar aquestes factures faria el model menys útil perquè els clients nous són precisament un dels casos on el risc és més incert. En lloc d'això, Payrithm inclou un indicador `history_available` i permet que el pipeline de preprocessament imputi els valors històrics absents.

Per a un client nou, el model encara pot utilitzar:

* Import de la factura
* Terminis de pagament
* Moneda
* Indústria
* Característiques de calendari
* Patrons globals apresos d'altres clients

L'indicador d'historial permet que el model distingeixi entre:

* Una taxa històrica real de retard igual a zero
* Una taxa absent perquè no existeix historial

Aquestes situacions no s'han de tractar com si fossin equivalents.

## Característiques addicionals del moment d'emissió

Es poden derivar característiques de calendari i contractuals de manera segura a partir de les dates d'emissió i venciment:

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

Prefereixo utilitzar l'import transformat logarítmicament perquè els imports de factura acostumen a tenir asimetria positiva. Un nombre reduït de factures molt grans podria dominar l'escala numèrica.

No incloc el `customer_id` brut com a característica categòrica. Fer-ho anima el model a memoritzar clients concrets i crea problemes quan apareixen clients no vistos.

Els agregats de comportament històric acostumen a ser més transferibles.

## Construcció del pipeline de Scikit-learn

Payrithm utilitza un `GradientBoostingClassifier` per a la probabilitat de pagament tardà.

Els arbres de decisió amb gradient boosting són un baseline potent per a dades de negoci estructurades perquè poden modelar:

* Relacions no lineals
* Interaccions entre variables
* Efectes de llindar
* Entrades numèriques i categòriques mixtes després del preprocessament

El preprocessament i el classificador s'embolcallen en un únic pipeline de scikit-learn.

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

Posar el preprocessament dins del pipeline no és només una comoditat.

Assegura que:

* Els valors d'imputació s'aprenen del conjunt d'entrenament
* Els mappings de categories s'aprenen del conjunt d'entrenament
* Les dades d'avaluació es transformen amb les regles del conjunt d'entrenament
* S'aplica el mateix preprocessament durant la inferència
* El model i les seves transformacions de característiques es poden versionar conjuntament

Ajustar transformacions abans de dividir les dades seria una altra forma de fuga.

## Per què una divisió train/test aleatòria és enganyosa

Un tutorial estàndard de machine learning podria utilitzar:

```python
from sklearn.model_selection import train_test_split

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42,
)
```

Això no és adequat per a aquest problema.

Una divisió aleatòria barreja factures antigues i recents. El model pot entrenar-se amb patrons de negoci futurs i després ser avaluat amb factures més antigues.

El desplegament real funciona en la direcció contrària:

1. Entrenar amb factures històriques
2. Predir factures que arriben més tard

L'avaluació ha de reproduir aquesta direcció.

Payrithm utilitza aproximadament el 20% més recent de les factures resoltes com a període d'avaluació.

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

Utilitzar la data d'emissió com a eix de divisió respon una pregunta realista:

> Si el model s'hagués entrenat al final del període d'entrenament, com hauria predit les factures emeses després?

Una avaluació cronològica acostuma a ser més difícil que una d'aleatòria. És esperable.

L'objectiu no és produir la mètrica més impressionant. És estimar honestament el rendiment futur.

## Entrenament del classificador

Després de generar característiques del moment d'emissió i seleccionar factures resoltes, l'entrenament és directe:

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

La sortida és una probabilitat entre zero i u.

Una factura amb probabilitat predita `0.82` es considera més arriscada que una amb `0.18`.

Però un model de risc útil necessita més que una ordenació correcta.

Les probabilitats també han de significar alguna cosa.

## Per què l'accuracy no és suficient

Suposa que el 80% de les factures es paguen a temps.

Un model que prediu «a temps» per a totes les factures aconsegueix un 80% d'accuracy sense aportar cap discriminació de risc útil.

L'accuracy també depèn d'escollir un llindar de classificació. Diferents equips de cobrament poden triar llindars diferents segons:

* Personal disponible
* Valor de les factures
* Relacions amb els clients
* Cost d'una intervenció innecessària
* Cost de no detectar pagaments tardans

Per això Payrithm avalua directament la sortida probabilística en lloc de dependre només de classificacions binàries per llindar.

Les principals mètriques del classificador són:

* ROC-AUC
* Brier score
* Brier score del baseline
* Comportament de calibratge

## ROC-AUC: pot el model ordenar el risc?

ROC-AUC mesura fins a quin punt el model separa factures tardanes de factures pagades a temps a través de tots els llindars possibles.

Una interpretació intuïtiva és:

> Si selecciono aleatòriament una factura tardana i una de puntual, amb quina freqüència el model assigna un risc superior a la tardana?

Un valor proper a:

* `0.50` indica un rànquing aleatori
* `1.00` indica un rànquing perfecte

```python
from sklearn.metrics import roc_auc_score

roc_auc = roc_auc_score(
    y_test,
    late_probabilities,
)
```

ROC-AUC és útil perquè els equips de cobrament normalment comencen amb un problema de rànquing. Volen les factures de més risc a la part superior de la cua.

Tanmateix, ROC-AUC no diu si els valors probabilístics són fiables.

Un model podria ordenar les factures correctament mentre assigna probabilitats sistemàticament massa altes o massa baixes.

## Calibratge de probabilitats

Un model calibrat produeix probabilitats que es corresponen amb les freqüències observades.

Entre les factures a les quals s'assigna un risc proper al 20%, aproximadament un 20% s'haurien d'acabar pagant tard.

Entre les factures a les quals s'assigna un risc proper al 80%, aproximadament un 80% s'haurien d'acabar pagant tard.

El calibratge és important perquè Payrithm utilitza probabilitats en decisions posteriors. Una puntuació de `0.80` ha de representar més que «risc alt»: ha d'aproximar una probabilitat de l'esdeveniment del 80%.

Es pot generar una taula de calibratge amb scikit-learn:

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

En un model perfectament calibrat, les columnes predita i observada serien iguals.

A la pràctica, inspecciono si el model:

* Subestima el risc en factures d'alt risc
* Sobreestima el risc en factures de baix risc
* Concentra les probabilitats en un rang estret
* Té un calibratge inestable en períodes amb poques dades

Quan cal millorar el calibratge, s'ha de fer amb un període de calibratge cronològic, no amb folds barrejats aleatòriament que trenquen l'estructura temporal.

## Brier score: mesurant la qualitat de la probabilitat

El Brier score mesura la diferència quadràtica mitjana entre les probabilitats predites i els resultats reals:

$$
\text{Brier Score}
=
\frac{1}{N}
\sum_{i=1}^{N}
(p_i-y_i)^2
$$

on:

* $(p_i)$ és la probabilitat predita de pagament tardà
* $(y_i)$ és el resultat binari real

Els valors més baixos són millors.

```python
from sklearn.metrics import brier_score_loss

brier = brier_score_loss(
    y_test,
    late_probabilities,
)
```

El Brier score penalitza fortament els errors amb molta confiança.

Considera dues factures que finalment es paguen tard:

| Resultat real | Predicció | Error quadràtic |
| --- | ---: | ---: |
| Tard | 0.90 | 0.01 |
| Tard | 0.10 | 0.81 |

La segona predicció no només està mal ordenada. Està equivocada amb molta confiança.

Això fa que el Brier score sigui especialment útil en sistemes on les probabilitats influeixen en decisions financeres.

## Comparar sempre amb un baseline

Una mètrica té poc significat sense un punt de referència.

El baseline probabilístic més senzill prediu la taxa de pagament tardà del conjunt d'entrenament per a totes les factures d'avaluació.

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

El classificador ha d'aconseguir un Brier score inferior al d'aquest baseline sobre el conjunt d'avaluació cronològica.

Payrithm registra mètriques com:

```python
training_metrics = {
    "classifier_roc_auc": roc_auc,
    "classifier_brier": brier,
    "classifier_baseline_brier": baseline_brier,
}
```

Un model no es promociona simplement perquè l'entrenament hagi acabat correctament. Ha de demostrar valor respecte d'un baseline cronològic.

Aquesta porta de desplegament evita que un model acabat d'entrenar però pitjor substitueixi automàticament l'actual.

## El model complementari de retard de pagament

La probabilitat de pagament tardà respon:

> És probable que aquesta factura es pagui tard?

No respon:

> Si es paga tard, quant de retard podria tenir?

Per això Payrithm entrena un segon model amb `GradientBoostingRegressor`.

La seva variable objectiu és `delay_days` i la mètrica principal d'avaluació és l'error absolut mitjà:

$$
\text{MAE}
=
\frac{1}{N}
\sum_{i=1}^{N}
|\hat{y}_i-y_i|
$$

El baseline prediu la mediana del retard d'entrenament per a totes les factures d'avaluació.

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

El classificador i el regressor proporcionen senyals complementaris:

* Probabilitat que la factura es pagui tard
* Retard estimat respecte de la data de venciment

Més endavant, aquests senyals poden donar suport al pronòstic de cobraments i a la planificació de cobrament.

## De les prediccions a les prioritats de cobrament

Una probabilitat alta de pagament tardà no converteix automàticament una factura en la màxima prioritat de cobrament.

Considera dues factures:

| Factura | Probabilitat de retard | Import | Venciment |
| --- | ---: | ---: | --- |
| A | 90% | $150 | D'aquí a 25 dies |
| B | 65% | $48,000 | Vençuda |

És més probable que la factura A es pagui tard, però la B pot requerir atenció immediata pel seu valor i urgència.

Per això Payrithm manté separades la predicció del model i la puntuació operativa de cobrament.

La puntuació de prioritat combina:

* **45%** probabilitat de pagament tardà
* **25%** percentil de l'import dins de la moneda
* **25%** urgència respecte al venciment
* **5%** pressió de recordatoris

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

on:

* $(P(\text{late}))$ és la probabilitat del model
* $(A)$ és el percentil de l'import dins de la moneda
* $(U)$ és la urgència normalitzada del venciment
* $(R)$ és la pressió normalitzada de recordatoris

El codi següent il·lustra el càlcul:

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

Les funcions de normalització es poden ajustar a la política de cobrament de l'organització. La decisió arquitectònica important és que la fórmula continuï sent comprensible.

Un responsable de cobraments ha de poder veure per què una factura apareix a prop de la part superior:

* Risc predit alt de pagament tardà
* Valor relatiu elevat de la factura
* Venciment proper o ja superat
* Diversos recordatoris previs

El rànquing no es presenta com un misteriós segon model de machine learning. És una regla de negoci explícita construïda al voltant d'una predicció del model.

## Per què importa aquesta separació

Mantenir separades la predicció de probabilitat i la priorització de cobrament aporta diversos beneficis.

### La predicció conserva la validesa temporal

El classificador només utilitza informació del moment d'emissió. Els camps operatius en viu no contaminen l'avaluació del model.

### La política de negoci continua sent ajustable

Una empresa pot canviar els pesos de prioritat sense tornar a entrenar el classificador.

Per exemple, podria augmentar el component d'import durant una manca de liquiditat o augmentar la urgència a prop del final d'un període de reporting.

### La cua és més fàcil d'explicar

Els usuaris poden entendre la contribució del risc, el valor, la urgència i l'activitat de recordatoris.

### El monitoratge del model continua sent significatiu

El classificador es pot avaluar contra els resultats reals de pagament tardà sense confondre la qualitat del model amb les regles del workflow posterior.

## Monitoratge del model després del desplegament

Una avaluació històrica satisfactòria no garanteix un rendiment permanent.

El comportament dels clients, les polítiques de pagament, els mercats i la composició de les factures poden canviar.

Per això Payrithm tracta les mètriques del model com a registres d'entrenament i no com a resultats puntuals d'un notebook.

Cada entrenament pot registrar:

* Límits del període d'entrenament
* Límits del període d'avaluació
* Nombre de factures resoltes
* Prevalença de pagament tardà
* ROC-AUC del classificador
* Brier score del classificador
* Brier score del baseline del classificador
* MAE del regressor
* MAE del baseline del regressor
* Versions de característiques i model

Amb el temps, l'aplicació pot comparar els resultats actuals amb les prediccions que es van fer originalment.

Preguntes importants de monitoratge:

* Ha canviat la taxa observada de pagament tardà?
* Les probabilitats predites continuen calibrades?
* Està empitjorant el Brier score?
* El model ha deixat de superar el baseline?
* Estan canviant les distribucions dels imports o els terminis de pagament?
* Es fan més prediccions per a clients sense historial?
* Ha canviat la distribució de monedes o indústries?

El reentrenament ha d'estar motivat per evidència, no només per un calendari arbitrari.

## Lliçons apreses

Construir el predictor de Payrithm va reforçar diverses lliçons aplicables molt més enllà de les dades de factures.

### La validesa temporal importa més que unes mètriques impressionants

Una puntuació cronològica més baixa però honesta és més valuosa que una puntuació inflada per una divisió aleatòria.

### L'historial del client s'ha de reconstruir

Agregar tot l'historial d'un client és fàcil. Reconstruir què se sabia realment en cada data de predicció és la veritable tasca de modelatge.

### El rànquing i la qualitat probabilística són diferents

ROC-AUC mesura si les factures arriscades pugen a la part superior. No garanteix que un risc predit del 80% es comporti realment com un 80%.

### Els baselines formen part del model

Un model no s'ha de desplegar simplement perquè sigui més sofisticat que una predicció constant. Ha de demostrar que millora aquesta predicció constant.

### Les prediccions necessiten una capa operativa

Una probabilitat només es torna útil quan es connecta amb el valor de la factura, la urgència i el workflow de cobrament.

### L'explicabilitat pot començar amb el disseny del sistema

No totes les explicacions requereixen un algoritme complex d'atribució. Separar el risc del model dels pesos explícits de negoci ja fa el resultat substancialment més fàcil d'entendre.

## Pipeline final

El flux complet de modelatge de Payrithm es pot resumir així:

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

El classificador en si només és una part de la solució.

La feina més important és definir quan es produeix la predicció, reconstruir la informació disponible en aquell moment, avaluar les probabilitats honestament i convertir la sortida en una decisió sobre la qual algú pugui actuar.

Aquesta és la diferència entre entrenar un classificador de factures i construir un producte de predicció de pagaments tardans.
