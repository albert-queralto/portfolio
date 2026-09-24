---
title: "Einen Vorhersager für verspätete Rechnungszahlungen mit Python und Scikit-learn entwickeln"
description: "Wie ich die Machine-Learning-Pipeline von Payrithm entwickelt habe, um verspätete Rechnungszahlungen ohne Data Leakage vorherzusagen, die Qualität von Wahrscheinlichkeiten zu bewerten und Modellausgaben in umsetzbare Inkassoprioritäten zu überführen."
date: 2026-07-25
lang: de
translationKey: payrithm
tags: ["Machine Learning", "Scikit-learn", "Python", "Fintech", "MLOps"]
draft: false
cover: "/og/invoice-late-payment-predictor.png"
featured: true
project: "payrithm"
---

Vorherzusagen, ob eine Rechnung verspätet bezahlt wird, klingt zunächst nach einem einfachen binären Klassifikationsproblem:

* `0`: Die Rechnung wird pünktlich bezahlt
* `1`: Die Rechnung wird verspätet bezahlt

Die schwierige Aufgabe ist nicht, einen Klassifikator zu trainieren. Schwierig ist es, ein Vorhersagesystem zu bauen, das genau die Informationen abbildet, die beim Erstellen einer neuen Rechnung tatsächlich bekannt wären.

Ein Modell kann sehr präzise wirken und dabei versehentlich Zahlungsinformationen aus der Zukunft verwenden. Es kann Rechnungen nach Risiko sortieren, ohne verlässliche Wahrscheinlichkeiten zu liefern. Und es kann technisch korrekte Vorhersagen erzeugen, die nie zu sinnvollen Inkassoentscheidungen führen.

Diese Probleme wollte ich mit **Payrithm** lösen, einer Accounts-Receivable-Intelligence-Anwendung, die verspätete Zahlungen vorhersagt, Zahlungszeitpunkte schätzt, Inkasso priorisiert und eingehende Liquidität prognostiziert.

In diesem Artikel gehe ich den vollständigen Modellierungsprozess durch:

1. Das Geschäftsproblem definieren
2. Rechnungsdaten vorbereiten
3. Temporales Data Leakage verhindern
4. Merkmale aus der Kundenhistorie entwickeln
5. Einen chronologischen Train/Test-Split erstellen
6. Ranking und Wahrscheinlichkeitsqualität bewerten
7. Vorhersagen in Inkassoprioritäten umwandeln

Die Beispiele verwenden Python, pandas und scikit-learn. Dieselben Prinzipien gelten für viele reale Vorhersagesysteme mit Kunden, Transaktionen und zeitabhängigem Verhalten.

## Das Geschäftsproblem

Accounts-Receivable-Teams haben selten genug Zeit, jede unbezahlte Rechnung gleich zu behandeln.

Ein Unternehmen kann Hunderte oder Tausende offene Rechnungen haben. Einige werden ohne Eingriff bezahlt. Andere benötigen Erinnerungen, Anrufe, Streitbeilegung oder Eskalation.

Die operative Frage lautet deshalb nicht einfach:

> Welche Rechnungen sind unbezahlt?

Nützlicher sind Fragen wie:

* Welche neu ausgestellten Rechnungen werden wahrscheinlich verspätet bezahlt?
* Wie lange nach dem Fälligkeitsdatum könnte die Zahlung eintreffen?
* Welche offenen Rechnungen verdienen zuerst Aufmerksamkeit?
* Wie viel Liquidität wird in den nächsten Wochen voraussichtlich eingehen?

Payrithm nähert sich dem Problem mit zwei verbundenen Machine-Learning-Modellen:

* Ein **Klassifikator**, der die Wahrscheinlichkeit einer verspäteten Zahlung schätzt
* Ein **Regressor**, der die Zahlungsverzögerung relativ zum Fälligkeitsdatum schätzt

Dieser Artikel konzentriert sich vor allem auf den Klassifikator.

Für eine Rechnung (i) schätzt der Klassifikator:

$$
P(Y_i = 1 \mid X_i)
$$

wobei:

* $(Y_i = 1)$ bedeutet, dass die Rechnung letztlich nach ihrem Fälligkeitsdatum bezahlt wird
* $(X_i)$ Informationen enthält, die bei Ausstellung der Rechnung verfügbar sind

Diese letzte Bedingung ist entscheidend.

Das Modell soll eine **Vorhersage zum Ausstellungszeitpunkt** treffen. Es soll sich so verhalten, als würde es am Tag der Rechnungserstellung laufen, nicht mehrere Wochen später, wenn Erinnerungen, Streitfälle, Überfälligkeitstage und Zahlungsergebnisse bereits bekannt sind.

## Das Vorhersageziel definieren

Für abgeschlossene Rechnungen lässt sich das Label für verspätete Zahlung ableiten, indem Zahlungs- und Fälligkeitsdatum verglichen werden:

$$
\text{paid\_late} =
\begin{cases}
1 & \text{wenn paid\_date} > \text{due\_date} \\
0 & \text{sonst}
\end{cases}
$$

Das Ziel für die Zahlungsverzögerung im ergänzenden Regressionsmodell ist:

$$
\text{delay\_days} =
\text{paid\_date} - \text{due\_date}
$$

Ein negativer Wert bedeutet, dass die Rechnung vorzeitig bezahlt wurde. Null bedeutet Zahlung am Fälligkeitstag. Ein positiver Wert entspricht der Zahl der verspäteten Tage.

Noch offene Rechnungen haben kein endgültiges Ergebnis und können deshalb nicht als überwachte Trainingsbeispiele verwendet werden. Nach dem Training können sie dennoch bewertet werden.

## Rechnungsdaten vorbereiten

Payrithm importiert Rechnungsdaten aus CSV-Dateien.

Die mindestens erforderlichen Felder sind:

| Feld | Beschreibung |
| --- | --- |
| `invoice_id` | Eindeutige Rechnungskennung |
| `customer_id` | Kennung des Kunden |
| `issue_date` | Ausstellungsdatum der Rechnung |
| `due_date` | Vertragliche Zahlungsfrist |
| `amount` | Rechnungsbetrag |

Das System kann außerdem optionale Felder verwenden wie:

* `paid_date`
* `currency`
* `customer_industry`
* `disputed`
* `dispute_opened_date`
* `reminders_sent`
* `last_reminder_date`

Der erste Vorbereitungsschritt besteht darin, Typen, Daten, Kennungen und grundlegende Geschäftsregeln zu validieren.

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

Produktionsvalidierung erfordert mehr als nur die Prüfung auf fehlende Werte.

Ich möchte beispielsweise auch erkennen:

* Zahlungsdaten vor dem Ausstellungsdatum
* Unerwartet lange oder negative Zahlungsziele
* Unbekannte Währungen
* Doppelte Rechnungskennungen
* Plötzliche Schemaänderungen
* Fehlerhaft formatierte oder falsch skalierte Beträge
* Kategorische Werte mit inkonsistenter Schreibweise

Diese Prüfungen verhindern, dass Datenqualitätsprobleme unbemerkt zum Modellverhalten werden.

## Beträge verschiedener Währungen niemals direkt kombinieren

Eine Rechnung über `10,000 USD` sollte nicht direkt mit einer über `10,000 EUR`, `10,000 GBP` oder `10,000 MXN` verglichen werden.

Payrithm vermeidet daher das Aggregieren oder Ranken roher Rechnungsbeträge über verschiedene Währungen hinweg.

Für die Inkassopriorisierung wird der Rechnungswert in ein Perzentil innerhalb seiner eigenen Währung umgewandelt:

```python
invoices["amount_percentile"] = (
    invoices.groupby("currency")["amount"]
    .rank(method="average", pct=True)
)
```

Das führt keine Währungsumrechnung durch, liefert aber ein nützliches relatives Signal:

> Wie groß ist diese Rechnung im Vergleich zu anderen Rechnungen derselben Währung?

Ein Produktionssystem könnte Werte zusätzlich mit einer vertrauenswürdigen Wechselkursquelle umrechnen. Das wirft jedoch weitere Fragen zu Kursdatum, Bilanzierungsrichtlinien und Reproduzierbarkeit auf.

## Das gefährlichste Problem: Data Leakage

Data Leakage entsteht, wenn beim Modelltraining Informationen verwendet werden, die zum Vorhersagezeitpunkt nicht verfügbar gewesen wären.

Bei Rechnungsvorhersagen ist das besonders leicht einzubauen, weil Datensätze häufig erst extrahiert werden, nachdem viele Rechnungen bereits bezahlt wurden.

Betrachte ein Modell, das mit diesen Spalten trainiert wird:

* `paid_date`
* `days_overdue`
* `reminders_sent`
* `last_reminder_date`
* `disputed`
* Prozentsatz verspäteter Kundenzahlungen, berechnet über alle Rechnungen

Die resultierenden Metriken könnten hervorragend aussehen. Das Modell könnte die Antwort indirekt bereits erhalten haben.

### Informationen, die nicht in ein Modell zum Ausstellungszeitpunkt gehören

| Feld oder Merkmal | Warum es leakt |
| --- | --- |
| `paid_date` | Verrät das endgültige Ergebnis direkt |
| `delay_days` | Wird aus dem Ziel abgeleitet |
| `paid_late` | Ist das Klassifikationsziel |
| Aktuelle Überfälligkeitstage | Eine neue Rechnung ist bei Ausstellung nicht überfällig |
| Zukünftige Erinnerungen | Sie treten nach dem Vorhersagedatum auf |
| Endgültiger Streitstatus | Der Streit kann erst nach Ausstellung entstanden sein |
| Gesamte historische Verspätungsquote des Kunden | Kann Rechnungen enthalten, die erst in der Zukunft abgeschlossen werden |
| Preprocessing auf allen Daten | Legt Statistiken des Evaluationssatzes offen |

Die Leitfrage für jedes potenzielle Merkmal lautet:

> Hätte ich diesen Wert am Ende des Ausstellungsdatums der Rechnung berechnen können?

Wenn die Antwort nein lautet, gehört das Merkmal nicht in das Modell für die Vorhersage bei Ausstellung.

## Vorhersagemerkmale und operative Merkmale sind verschieden

Payrithm trennt zwei Konzepte, die häufig fälschlicherweise vermischt werden.

### Vorhersagemerkmale zum Ausstellungszeitpunkt

Diese werden vom Machine-Learning-Modell verwendet:

* Rechnungsbetrag
* Währung
* Zahlungsziel
* Ausstellungsmonat
* Wochentag der Ausstellung
* Branche des Kunden
* Kundenverhalten, das vor Ausstellung bekannt war
* Ob ausreichend Kundenhistorie vorhanden ist

### Operative Live-Merkmale

Diese können später zur Sortierung aktuell offener Rechnungen verwendet werden:

* Tage bis zum Fälligkeitsdatum
* Ob die Rechnung bereits überfällig ist
* Anzahl gesendeter Erinnerungen
* Zeit seit der letzten Erinnerung
* Aktueller Streitstatus
* Aktueller Rechnungsstatus

Operative Live-Signale sind für Inkassoentscheidungen nützlich, dürfen dem Modell aber nicht so präsentiert werden, als wären sie bei Ausstellung bekannt gewesen.

Die Trennung von Vorhersage und Priorisierung macht das System leichter nachvollziehbar und evaluierbar.

## Merkmale aus der Kundenhistorie entwickeln

Das frühere Zahlungsverhalten eines Kunden ist eine der nützlichsten Quellen prädiktiver Information.

Mögliche historische Merkmale sind:

* Anzahl zuvor abgeschlossener Rechnungen
* Historische Quote verspäteter Zahlungen
* Durchschnittliche Verzögerung relativ zum Fälligkeitsdatum
* Maximale historische Verzögerung
* Durchschnittliche Tage zwischen Ausstellung und Zahlung
* Ob der Kunde eine nutzbare Historie besitzt

Die naive Implementierung wäre:

```python
invoices.groupby("customer_id")["paid_late"].mean()
```

Diese Berechnung ist unsicher.

Sie verwendet die gesamte Kundenhistorie, einschließlich Rechnungen, die nach der aktuell modellierten Rechnung ausgestellt und bezahlt wurden.

Stattdessen braucht jede Rechnung einen historischen Snapshot, rekonstruiert zum Zeitpunkt ihrer Ausstellung.

Für eine zum Zeitpunkt (t) ausgestellte Rechnung ist eine frühere Rechnung nur dann für Merkmale aus abgeschlossener Historie geeignet, wenn:

1. Sie zum selben Kunden gehört
2. Sie vor (t) ausgestellt wurde
3. Ihr Zahlungsergebnis vor (t) bekannt war

Die dritte Bedingung ist wichtig. Eine frühere Rechnung kann bei (t) bereits existiert haben; wenn sie aber noch offen war, war ihr späteres Ergebnis noch unbekannt.

Die folgende Implementierung priorisiert Verständlichkeit vor maximaler Performance:

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

Diese Implementierung filtert wiederholt und wird bei sehr großen Datensätzen langsam. In Produktion lässt sich dieselbe Logik effizienter mit chronologischer Ereignisverarbeitung, expandierenden Aggregaten oder Datenbank-Window-Operationen umsetzen.

Entscheidend ist die temporale Regel, nicht die exakte Implementierung.

## Neue Kunden behandeln

Ein neuer Kunde besitzt möglicherweise noch keine abgeschlossene Rechnungshistorie.

Das ist ein klassisches Cold-Start-Problem.

Diese Rechnungen zu entfernen würde das Modell weniger nützlich machen, denn gerade bei neuen Kunden ist das Risiko oft besonders unsicher. Stattdessen enthält Payrithm einen `history_available`-Indikator und lässt fehlende historische Werte in der Preprocessing-Pipeline imputieren.

Für einen neuen Kunden kann das Modell weiterhin verwenden:

* Rechnungsbetrag
* Zahlungsziel
* Währung
* Branche
* Kalendermerkmale
* Globale Muster, die von anderen Kunden gelernt wurden

Der Historienindikator ermöglicht dem Modell die Unterscheidung zwischen:

* Einer echten historischen Verspätungsquote von null
* Einer fehlenden Quote, weil keine Historie existiert

Diese Situationen sollten nicht gleich behandelt werden.

## Zusätzliche Merkmale zum Ausstellungszeitpunkt

Kalender- und Vertragsmerkmale können sicher aus Ausstellungs- und Fälligkeitsdatum abgeleitet werden:

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

Ich bevorzuge einen logarithmierten Rechnungsbetrag, weil Rechnungswerte typischerweise rechtsschief verteilt sind. Eine kleine Zahl sehr großer Rechnungen könnte sonst die numerische Skala dominieren.

Die rohe `customer_id` verwende ich nicht als kategoriales Merkmal. Das würde das Modell dazu ermutigen, einzelne Kunden auswendig zu lernen, und verursacht Probleme bei bisher ungesehenen Kunden.

Aggregate historischen Verhaltens sind in der Regel besser übertragbar.

## Die Scikit-learn-Pipeline aufbauen

Payrithm verwendet einen `GradientBoostingClassifier` für die Wahrscheinlichkeit verspäteter Zahlung.

Gradient-Boosted Decision Trees sind eine starke Baseline für strukturierte Geschäftsdaten, weil sie modellieren können:

* Nichtlineare Beziehungen
* Interaktionen zwischen Variablen
* Schwelleneffekte
* Gemischte numerische und kategoriale Eingaben nach dem Preprocessing

Preprocessing und Klassifikator werden in einer einzigen scikit-learn-Pipeline gekapselt.

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

Preprocessing innerhalb der Pipeline ist nicht nur bequem.

Es stellt sicher, dass:

* Imputationswerte nur aus dem Trainingssatz gelernt werden
* Kategorie-Mappings nur aus dem Trainingssatz gelernt werden
* Evaluationsdaten mit den Regeln des Trainingssatzes transformiert werden
* Bei der Inferenz dasselbe Preprocessing angewandt wird
* Modell und Merkmalstransformationen gemeinsam versioniert werden können

Transformationen vor dem Split auf allen Daten zu fitten wäre eine weitere Form von Leakage.

## Warum ein zufälliger Train/Test-Split irreführend ist

Ein übliches Machine-Learning-Tutorial könnte Folgendes verwenden:

```python
from sklearn.model_selection import train_test_split

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42,
)
```

Für dieses Problem ist das ungeeignet.

Ein zufälliger Split vermischt alte und neue Rechnungen. Das Modell kann auf zukünftigen Geschäftsmustern trainieren und anschließend an älteren Rechnungen evaluiert werden.

Ein echtes Deployment funktioniert in der Gegenrichtung:

1. Auf historischen Rechnungen trainieren
2. Später eintreffende Rechnungen vorhersagen

Die Evaluation sollte diese Richtung reproduzieren.

Payrithm verwendet die ungefähr neuesten 20% der abgeschlossenen Rechnungen als Evaluationszeitraum.

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

Das Ausstellungsdatum als Split-Achse beantwortet eine realistische Frage:

> Wenn das Modell am Ende des Trainingszeitraums trainiert worden wäre, wie gut hätte es anschließend ausgestellte Rechnungen vorhergesagt?

Eine chronologische Evaluation ist oft schwieriger als eine zufällige. Das ist zu erwarten.

Das Ziel ist nicht die beeindruckendste Metrik, sondern eine ehrliche Schätzung zukünftiger Performance.

## Den Klassifikator trainieren

Nach dem Erzeugen der Merkmale zum Ausstellungszeitpunkt und der Auswahl abgeschlossener Rechnungen ist das Training unkompliziert:

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

Die Ausgabe ist eine Wahrscheinlichkeit zwischen null und eins.

Eine Rechnung mit vorhergesagter Wahrscheinlichkeit `0.82` gilt als riskanter als eine mit `0.18`.

Ein nützliches Risikomodell braucht jedoch mehr als die richtige Reihenfolge.

Auch seine Wahrscheinlichkeiten müssen Bedeutung haben.

## Warum Accuracy nicht ausreicht

Angenommen, 80% der Rechnungen werden pünktlich bezahlt.

Ein Modell, das für jede Rechnung „pünktlich“ vorhersagt, erreicht 80% Accuracy und bietet trotzdem keinerlei nützliche Risikodifferenzierung.

Accuracy hängt außerdem von der Wahl eines Klassifikationsschwellenwerts ab. Unterschiedliche Inkassoteams können je nach Situation unterschiedliche Schwellen verwenden:

* Verfügbares Personal
* Rechnungswert
* Kundenbeziehungen
* Kosten unnötiger Intervention
* Kosten übersehener verspäteter Zahlungen

Payrithm bewertet deshalb direkt die Wahrscheinlichkeitsausgabe, statt sich nur auf geschwellte Klassifikationen zu verlassen.

Die wichtigsten Klassifikator-Metriken sind:

* ROC-AUC
* Brier Score
* Baseline-Brier-Score
* Kalibrierungsverhalten

## ROC-AUC: Kann das Modell Risiko ranken?

ROC-AUC misst, wie gut das Modell verspätete von pünktlichen Rechnungen über alle möglichen Schwellenwerte hinweg trennt.

Eine intuitive Interpretation lautet:

> Wenn ich zufällig eine verspätete und eine pünktliche Rechnung auswähle, wie oft weist das Modell der verspäteten Rechnung einen höheren Risikoscore zu?

Ein Wert nahe:

* `0.50` bedeutet zufälliges Ranking
* `1.00` bedeutet perfektes Ranking

```python
from sklearn.metrics import roc_auc_score

roc_auc = roc_auc_score(
    y_test,
    late_probabilities,
)
```

ROC-AUC ist wertvoll, weil Inkassoteams häufig mit einem Rankingproblem beginnen. Sie möchten die Rechnungen mit dem höchsten Risiko weit oben in der Warteschlange sehen.

ROC-AUC sagt jedoch nicht aus, ob die Wahrscheinlichkeitswerte zuverlässig sind.

Ein Modell kann Rechnungen korrekt ranken und trotzdem Wahrscheinlichkeiten liefern, die systematisch zu hoch oder zu niedrig sind.

## Wahrscheinlichkeitskalibrierung

Ein kalibriertes Modell produziert Wahrscheinlichkeiten, die beobachteten Häufigkeiten entsprechen.

Von Rechnungen mit einem Risiko um 20% sollten ungefähr 20% tatsächlich verspätet bezahlt werden.

Von Rechnungen mit einem Risiko um 80% sollten ungefähr 80% tatsächlich verspätet bezahlt werden.

Kalibrierung ist wichtig, weil Payrithm Wahrscheinlichkeiten in nachgelagerten Entscheidungen verwendet. Ein Score von `0.80` sollte mehr bedeuten als „hohes Risiko“; er sollte ungefähr einer Ereigniswahrscheinlichkeit von 80% entsprechen.

Eine Kalibrierungstabelle lässt sich mit scikit-learn erzeugen:

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

Bei einem perfekt kalibrierten Modell wären vorhergesagte und beobachtete Spalte gleich.

In der Praxis prüfe ich, ob das Modell:

* Risiko bei Hochrisikorechnungen unterschätzt
* Risiko bei Niedrigrisikorechnungen überschätzt
* Wahrscheinlichkeiten in einem engen Bereich konzentriert
* In datenarmen Zeiträumen instabile Kalibrierung zeigt

Wenn die Kalibrierung verbessert werden muss, sollte das mit einem chronologischen Kalibrierungszeitraum erfolgen, nicht mit zufällig gemischten Folds, die die temporale Struktur zerstören.

## Brier Score: Wahrscheinlichkeitsqualität messen

Der Brier Score misst die mittlere quadratische Differenz zwischen vorhergesagten Wahrscheinlichkeiten und tatsächlichen Ergebnissen:

$$
\text{Brier Score}
=
\frac{1}{N}
\sum_{i=1}^{N}
(p_i-y_i)^2
$$

wobei:

* $(p_i)$ die vorhergesagte Wahrscheinlichkeit verspäteter Zahlung ist
* $(y_i)$ das tatsächliche binäre Ergebnis ist

Niedrigere Werte sind besser.

```python
from sklearn.metrics import brier_score_loss

brier = brier_score_loss(
    y_test,
    late_probabilities,
)
```

Der Brier Score bestraft selbstbewusste Fehler stark.

Betrachte zwei Rechnungen, die tatsächlich verspätet bezahlt werden:

| Tatsächliches Ergebnis | Vorhersage | Quadratischer Fehler |
| --- | ---: | ---: |
| Verspätet | 0.90 | 0.01 |
| Verspätet | 0.10 | 0.81 |

Die zweite Vorhersage ist nicht nur falsch gerankt. Sie ist mit hoher Sicherheit falsch.

Das macht den Brier Score besonders nützlich für Systeme, in denen Wahrscheinlichkeiten finanzielle Entscheidungen beeinflussen.

## Immer mit einer Baseline vergleichen

Eine Metrik hat ohne Referenzpunkt wenig Aussagekraft.

Die einfachste Wahrscheinlichkeits-Baseline sagt für jede Evaluationsrechnung die Verspätungsquote des Trainingssatzes voraus.

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

Der Klassifikator sollte auf dem chronologischen Evaluationssatz einen niedrigeren Brier Score als diese Baseline erreichen.

Payrithm zeichnet Metriken wie diese auf:

```python
training_metrics = {
    "classifier_roc_auc": roc_auc,
    "classifier_brier": brier,
    "classifier_baseline_brier": baseline_brier,
}
```

Ein Modell wird nicht allein deshalb promoviert, weil das Training erfolgreich abgeschlossen wurde. Es muss einen Mehrwert gegenüber einer chronologischen Baseline zeigen.

Dieses Deployment-Gate verhindert, dass ein neu trainiertes, aber schwächeres Modell automatisch das aktuelle ersetzt.

## Das ergänzende Modell für Zahlungsverzögerung

Die Wahrscheinlichkeit verspäteter Zahlung beantwortet:

> Wird diese Rechnung wahrscheinlich verspätet bezahlt?

Sie beantwortet nicht:

> Wenn sie verspätet ist, wie groß könnte die Verzögerung sein?

Payrithm trainiert deshalb ein zweites Modell mit `GradientBoostingRegressor`.

Sein Ziel ist `delay_days`, und die wichtigste Evaluationsmetrik ist der Mean Absolute Error:

$$
\text{MAE}
=
\frac{1}{N}
\sum_{i=1}^{N}
|\hat{y}_i-y_i|
$$

Die Baseline sagt für jede Evaluationsrechnung die Median-Verzögerung des Trainingssatzes voraus.

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

Klassifikator und Regressor liefern komplementäre Signale:

* Wahrscheinlichkeit, dass die Rechnung verspätet bezahlt wird
* Geschätzte Verzögerung relativ zum Fälligkeitsdatum

Diese Signale können später Cash-Receipt-Forecasting und Inkassoplanung unterstützen.

## Von Vorhersagen zu Inkassoprioritäten

Eine hohe Wahrscheinlichkeit verspäteter Zahlung macht eine Rechnung nicht automatisch zur höchsten Inkassopriorität.

Betrachte zwei Rechnungen:

| Rechnung | Verspätungswahrscheinlichkeit | Betrag | Fälligkeit |
| --- | ---: | ---: | --- |
| A | 90% | $150 | In 25 Tagen |
| B | 65% | $48,000 | Überfällig |

Rechnung A wird mit höherer Wahrscheinlichkeit verspätet bezahlt, doch Rechnung B kann wegen Wert und Dringlichkeit sofortige Aufmerksamkeit verdienen.

Payrithm hält deshalb Modellvorhersage und operativen Inkassoscore getrennt.

Der Prioritätsscore kombiniert:

* **45%** Wahrscheinlichkeit verspäteter Zahlung
* **25%** Betragsperzentil innerhalb der Währung
* **25%** Fälligkeitsdringlichkeit
* **5%** Erinnerungsdruck

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

wobei:

* $(P(\text{late}))$ die Modellwahrscheinlichkeit ist
* $(A)$ das Betragsperzentil innerhalb der Währung ist
* $(U)$ die normalisierte Fälligkeitsdringlichkeit ist
* $(R)$ der normalisierte Erinnerungsdruck ist

Der folgende Code illustriert die Berechnung:

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

Die Normalisierungsfunktionen können an die Inkassorichtlinie der Organisation angepasst werden. Die wichtige Architekturentscheidung ist, dass die Formel verständlich bleibt.

Ein Inkassoverantwortlicher sollte erkennen können, warum eine Rechnung weit oben erscheint:

* Hohes vorhergesagtes Risiko verspäteter Zahlung
* Hoher relativer Rechnungswert
* Bald fällig oder bereits überfällig
* Mehrere vorherige Erinnerungen

Das Ranking wird nicht als mysteriöses zweites Machine-Learning-Modell präsentiert. Es ist eine explizite Geschäftsregel rund um eine Modellvorhersage.

## Warum diese Trennung wichtig ist

Die Trennung von Wahrscheinlichkeitsvorhersage und Inkassopriorisierung bringt mehrere Vorteile.

### Die Vorhersage bleibt temporal valide

Der Klassifikator verwendet ausschließlich Informationen vom Ausstellungszeitpunkt. Operative Live-Felder verunreinigen die Modellevaluation nicht.

### Die Geschäftspolitik bleibt anpassbar

Ein Unternehmen kann die Prioritätsgewichte ändern, ohne den Klassifikator neu zu trainieren.

Beispielsweise könnte es während eines Liquiditätsengpasses den Betragsanteil erhöhen oder gegen Ende eines Berichtszeitraums die Dringlichkeit stärker gewichten.

### Die Warteschlange ist leichter erklärbar

Benutzer können die Beiträge von Risiko, Wert, Dringlichkeit und Erinnerungsaktivität nachvollziehen.

### Modellmonitoring bleibt aussagekräftig

Der Klassifikator kann gegen tatsächliche verspätete Zahlungsergebnisse evaluiert werden, ohne Modellqualität mit nachgelagerten Workflow-Regeln zu vermischen.

## Das Modell nach dem Deployment überwachen

Eine erfolgreiche historische Evaluation garantiert keine dauerhafte Performance.

Kundenverhalten, Zahlungsrichtlinien, Märkte und die Zusammensetzung von Rechnungen können sich ändern.

Payrithm behandelt Modellmetriken deshalb als Trainingsdatensätze und nicht als einmalige Notebook-Ausgaben.

Jeder Trainingslauf kann aufzeichnen:

* Grenzen des Trainingszeitraums
* Grenzen des Evaluationszeitraums
* Anzahl abgeschlossener Rechnungen
* Prävalenz verspäteter Zahlungen
* Klassifikator-ROC-AUC
* Klassifikator-Brier-Score
* Baseline-Brier-Score des Klassifikators
* Regressor-MAE
* Baseline-MAE des Regressors
* Feature- und Modellversionen

Im Laufe der Zeit kann die Anwendung aktuelle Ergebnisse mit den ursprünglich erzeugten Vorhersagen vergleichen.

Wichtige Monitoring-Fragen sind:

* Hat sich die beobachtete Verspätungsquote verändert?
* Sind die vorhergesagten Wahrscheinlichkeiten weiterhin kalibriert?
* Verschlechtert sich der Brier Score?
* Schlägt das Modell seine Baseline nicht mehr?
* Driften Rechnungsbeträge oder Zahlungsziele?
* Werden mehr Vorhersagen für Kunden ohne Historie erzeugt?
* Hat sich die Verteilung von Währungen oder Branchen verändert?

Retraining sollte durch Evidenz ausgelöst werden, nicht allein durch einen willkürlichen Zeitplan.

## Erkenntnisse

Die Entwicklung des Payrithm-Prädiktors hat mehrere Lektionen bestätigt, die weit über Rechnungsdaten hinausgehen.

### Temporale Validität ist wichtiger als beeindruckende Metriken

Ein niedrigerer, aber ehrlicher chronologischer Score ist wertvoller als ein durch zufällige Splits aufgeblähter Score.

### Kundenhistorie muss rekonstruiert werden

Die gesamte Historie eines Kunden zu aggregieren ist einfach. Zu rekonstruieren, was an jedem Vorhersagedatum tatsächlich bekannt war, ist die eigentliche Modellierungsaufgabe.

### Ranking und Wahrscheinlichkeitsqualität sind verschieden

ROC-AUC misst, ob riskante Rechnungen nach oben wandern. Es garantiert nicht, dass ein vorhergesagtes Risiko von 80% sich tatsächlich wie 80% verhält.

### Baselines sind Teil des Modells

Ein Modell sollte nicht nur deshalb deployed werden, weil es komplexer als eine konstante Vorhersage ist. Es muss zeigen, dass es diese konstante Vorhersage verbessert.

### Vorhersagen brauchen eine operative Schicht

Eine Wahrscheinlichkeit wird erst nützlich, wenn sie mit Rechnungswert, Dringlichkeit und Inkasso-Workflow verbunden wird.

### Erklärbarkeit kann beim Systemdesign beginnen

Nicht jede Erklärung benötigt einen komplexen Attributionsalgorithmus. Schon die Trennung von Modellrisiko und expliziten Geschäftsgewichten macht das Ergebnis wesentlich leichter verständlich.

## Finale Pipeline

Der vollständige Modellierungsablauf von Payrithm lässt sich so zusammenfassen:

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

Der Klassifikator selbst ist nur ein Teil der Lösung.

Die wichtigere Arbeit liegt darin, den Vorhersagezeitpunkt zu definieren, die zu diesem Zeitpunkt verfügbaren Informationen zu rekonstruieren, Wahrscheinlichkeiten ehrlich zu evaluieren und die Ausgabe in eine Entscheidung umzuwandeln, auf die jemand reagieren kann.

Das ist der Unterschied zwischen dem Training eines Rechnungsklassifikators und dem Bau eines Produkts zur Vorhersage verspäteter Zahlungen.
