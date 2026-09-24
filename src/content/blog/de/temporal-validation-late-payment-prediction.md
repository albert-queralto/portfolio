---
title: "Zeitliche Validierung für die Vorhersage verspäteter Zahlungen"
description: "Warum die Vorhersage verspäteter Zahlungen mehr als einen chronologischen Train/Test-Split benötigt und wie ich rekonstruiere, welches Wissen zum Zeitpunkt jeder Payrithm-Vorhersage tatsächlich verfügbar gewesen wäre."
date: 2026-09-05
lang: de
translationKey: temporal-validation-late-payment-prediction
tags: ["Machine Learning", "Time Series", "Scikit-learn", "Fintech", "MLOps"]
draft: false
cover: "/og/temporal-validation-late-payment-prediction.png"
featured: false
project: "payrithm"
---

Vorherzusagen, ob eine Rechnung verspätet bezahlt wird, sieht zunächst wie ein gewöhnliches binäres Klassifikationsproblem aus.

Das ist es nicht.

Der schwierige Teil besteht nicht darin, den Klassifikator zu trainieren. Schwierig ist sicherzustellen, dass das Modell niemals aus Informationen lernt, die erst nach dem Zeitpunkt verfügbar wären, zu dem es seine Vorhersage eigentlich treffen soll.

Beim Aufbau von **Payrithm** wurde genau das zur wichtigsten Einschränkung in der Machine-Learning-Pipeline.

Für jedes Feature stelle ich mir dieselbe Frage:

> Hätte ich diesen Wert am Ende des Ausstellungsdatums der Rechnung berechnen können?

Wenn die Antwort nein lautet, gehört das Feature nicht in das Modell für die Vorhersage zum Ausstellungszeitpunkt.

## Zeit tritt im Problem zweimal auf

Ein Rechnungsdatensatz enthält mehrere unterschiedliche Datumsangaben:

- Ausstellungsdatum,
- Fälligkeitsdatum,
- Zahlungsdatum,
- Erinnerungsdaten,
- und Streitfalldaten.

Es liegt nahe zu glauben, dass eine Sortierung der Datensätze nach `issue_date` zeitliches Leakage verhindert.

Das tut sie nicht.

Betrachten wir zwei Rechnungen desselben Kunden:

```text
Rechnung A
ausgestellt: 1. Januar
bezahlt: 15. März

Rechnung B
ausgestellt: 1. Februar
```

Rechnung A existierte bereits, als Rechnung B ausgestellt wurde.

Ihr endgültiges Zahlungsergebnis war zu diesem Zeitpunkt jedoch noch nicht bekannt.

Wenn ich für Rechnung B die historische Verspätungsquote des Kunden anhand der späteren Zahlung von Rechnung A im März berechne, habe ich Informationen aus der Zukunft einfließen lassen.

Dadurch entstehen zwei getrennte Uhren:

```text
Ereignis ist eingetreten
vs.
Ergebnis wurde bekannt
```

Dieser Unterschied lässt sich leicht übersehen.

## Historisches Wissen rekonstruieren

Für jede neue Rechnung zum Zeitpunkt \(t\) darf eine frühere Rechnung nur dann zu aufgelösten Kundenhistorien-Features beitragen, wenn:

```text
früheres Ausstellungsdatum < t
AND
früheres Zahlungsdatum < t
```

Die zweite Bedingung ist die entscheidende.

Konzeptionell:

```python
known_history = customer_invoices[
    (customer_invoices["issue_date"] < cutoff)
    & customer_invoices["paid_date"].notna()
    & (customer_invoices["paid_date"] < cutoff)
]
```

Aus diesen Datensätzen kann ich sicher Features berechnen wie:

- Anzahl historisch abgeschlossener Rechnungen,
- historische Quote verspäteter Zahlungen,
- durchschnittliche Zahlungsverzögerung,
- maximale Zahlungsverzögerung,
- und durchschnittliche Dauer von Ausstellung bis Zahlung.

Damit erhält jede Rechnung eine historische Momentaufnahme, die zu ihrem eigenen Vorhersagezeitpunkt passt.

Die Trainingstabelle ist also nicht einfach ein Datensatz aus Rechnungen.

Sie ist ein Datensatz aus **historischen Zuständen**.

## Warum ein `groupby` über den gesamten Datensatz gefährlich ist

Der bequeme Ansatz wäre etwa:

```python
df.groupby("customer_id")["paid_late"].mean()
```

Das erzeugt ein auf den ersten Blick sinnvolles Kundenrisiko-Feature.

Für historische Vorhersagen ist es jedoch falsch.

Die Berechnung kann Folgendes enthalten:

- später ausgestellte Rechnungen,
- später bezahlte Rechnungen,
- und möglicherweise sogar die Zielrechnung selbst.

Die Modellevaluation kann hervorragend aussehen, weil das Feature eine komprimierte Version der Zukunft enthält.

Genau deshalb ist Leakage in Geschäftsdaten so gefährlich: Es sieht häufig wie legitimes Feature Engineering aus.

## Kunden ohne Historie müssen im Datensatz bleiben

Eine weitere Schwierigkeit sind Kunden ohne abgeschlossene Historie.

Sie zu entfernen macht das Modellierungsproblem einfacher, die Anwendung aber weniger nützlich.

Ein neu gewonnener Kunde ist gerade eine Situation, in der das Zahlungsverhalten besonders unsicher ist.

Payrithm unterscheidet deshalb zwischen:

```text
customer_late_rate = 0
```

und:

```text
customer_late_rate = unbekannt, weil keine Historie existiert
```

Ich verwende einen `history_available`-Indikator und lasse die Preprocessing-Pipeline fehlende historische Aggregate imputieren.

Das Modell kann weiterhin Informationen verwenden, die zum Ausstellungszeitpunkt verfügbar sind, zum Beispiel:

- Betrag,
- Zahlungsbedingungen,
- Währung,
- Branche,
- Ausstellungsmonat,
- und Wochentag,

während es gleichzeitig berücksichtigt, dass Kundenhistorien-Features nicht verfügbar waren.

## Der Evaluationsdatensatz muss aus der Zukunft stammen

Nachdem zeitlich valide Features konstruiert wurden, muss auch der Train/Test-Split dieselbe zeitliche Richtung einhalten.

Payrithm sortiert abgeschlossene Rechnungen nach Ausstellungsdatum und verwendet ungefähr die neuesten **20 %** als Evaluationszeitraum.

Konzeptionell:

```text
älteste -------------------------------------- neueste

|                  Training                  | Evaluation |
```

Das Modell trainiert niemals auf einer Rechnung, die nach einer Evaluationsrechnung ausgestellt wurde.

Damit beantworte ich die Frage, die mich tatsächlich interessiert:

> Wenn ich dieses Modell am Ende des historischen Trainingszeitraums trainiert hätte, wie hätte es bei den unmittelbar danach eingegangenen Rechnungen abgeschnitten?

Das ist deutlich realistischer als die Frage, wie gut das Modell nach einem zufälligen Durchmischen der Unternehmenshistorie funktioniert.

## Auch Preprocessing kann Leakage verursachen

Zeitliches Leakage beschränkt sich nicht auf Features.

Angenommen, ich berechne Medianwerte über den gesamten Datensatz und teile ihn erst danach auf.

Dann hat der Evaluationszeitraum das Trainings-Preprocessing bereits beeinflusst.

Dasselbe Problem gilt für:

- Imputation,
- Kategorien-Mappings,
- Skalierung,
- Feature-Auswahl,
- und Kalibrierung.

Das ist einer der Gründe, warum ich das Preprocessing innerhalb der scikit-learn-Pipeline halte.

Die Pipeline wird ausschließlich auf den Trainingsdaten angepasst.

Evaluationsdatensätze werden mit Parametern transformiert, die aus der Vergangenheit gelernt wurden.

## Ranking ist nur die Hälfte des Problems

Payrithm verwendet einen Gradient-Boosting-Klassifikator, um Folgendes zu schätzen:

\[
P(\text{verspätete Zahlung} \mid X)
\]

ROC-AUC zeigt mir, ob das Modell dazu tendiert, verspätet bezahlte Rechnungen höher einzustufen als pünktlich bezahlte.

Payrithm verwendet die Wahrscheinlichkeit später im System jedoch direkt weiter.

Ein vorhergesagtes Risiko von 80 % sollte mehr bedeuten als:

> Diese Rechnung hat ein hohes Risiko.

Idealerweise sollte es bedeuten, dass Rechnungen mit ähnlichen vorhergesagten Wahrscheinlichkeiten in ungefähr 80 % der Fälle tatsächlich verspätet bezahlt werden.

Deshalb ist Kalibrierung wichtig.

## Auch die Kalibrierung muss die Zeit respektieren

Ein üblicher Kalibrierungsworkflow verwendet zufällige Cross-Validation.

Bei zeitlichen Vorhersagen kann dadurch genau dasselbe Problem wieder entstehen, das ich zuvor beseitigen wollte.

Wenn eine Kalibrierung notwendig ist, sollte auch der Kalibrierungszeitraum nach dem Modell-Trainingszeitraum und vor dem finalen Evaluationszeitraum liegen.

Konzeptionell:

```text
Vergangenheit                               Zukunft
|---------- Training ----------| Kalibrierung | Evaluation |
```

Jede Stufe bewegt sich nach vorn.

Nichts lernt rückwärts.

## Mit einer Wahrscheinlichkeits-Baseline vergleichen

Ein Machine-Learning-Modell sollte außerdem etwas Einfacheres schlagen.

Für die Wahrscheinlichkeit verspäteter Zahlungen ist eine bewusst langweilige Baseline:

```text
die historische Verspätungsquote des Trainings
für jede Evaluationsrechnung vorhersagen
```

Ich bewerte die Qualität der Wahrscheinlichkeiten mit dem Brier Score:

\[
\frac{1}{N}\sum_{i=1}^{N}(p_i-y_i)^2
\]

und vergleiche ihn mit dieser Baseline.

Wenn das Modell den historischen Basisraten-Prädiktor bei zukünftigen Rechnungen nicht schlagen kann, wäre ein Deployment nur deshalb, weil das Training erfolgreich abgeschlossen wurde, nicht sinnvoll.

## Zeitliche Validität endet nicht mit dem Deployment

Ein chronologischer Holdout löst das Problem nicht endgültig.

Zahlungsverhalten verändert sich. Die Zusammensetzung der Kunden verändert sich. Zahlungsbedingungen verändern sich. Wirtschaftliche Rahmenbedingungen verändern sich. Auch der Anteil von Kunden ohne Historie kann sich verändern.

Für jeden Trainingslauf möchte ich Informationen speichern wie:

- Grenzen des Trainingszeitraums,
- Grenzen des Evaluationszeitraums,
- Häufigkeit verspäteter Zahlungen,
- ROC-AUC,
- Brier Score,
- Brier Score der Baseline,
- Feature-Version,
- und Modellversion.

Dadurch erhalten zukünftige Trainingsläufe eine sinnvolle Vergleichsbasis.

## Die allgemeinere Lektion

Die gefährlichste Form von Leakage ist nicht eine offensichtlich unzulässige Spalte namens `target`.

Es ist ein Feature, das vernünftig aussieht, aber unbemerkt Wissen aus der Zukunft enthält.

Zeitliche Modelle benötigen deshalb eine strengere Definition von Korrektheit:

> Eine Trainingszeile sollte den Informationszustand reproduzieren, der zum realen Vorhersagezeitpunkt tatsächlich existiert hätte.

Seit ich die Rekonstruktion historischer Zustände als Teil des Modells behandle — und nicht nur als Datenvorbereitung — lässt sich die übrige Payrithm-Pipeline deutlich leichter nachvollziehen.

Das Ziel ist nicht, die beeindruckendste Offline-Metrik zu erzeugen.

Das Ziel ist eine Evaluation, der ich auch dann vertrauen würde, wenn die nächste Rechnung eintrifft.
