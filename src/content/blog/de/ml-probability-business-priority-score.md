---
title: "Von ML-Wahrscheinlichkeit zum geschäftlichen Prioritätsscore"
description: "Warum Payrithm Rechnungen nicht einfach nach der Wahrscheinlichkeit verspäteter Zahlung sortiert und wie ich kalibriertes ML-Risiko mit Wert, Dringlichkeit und Inkassoaktivität kombiniere."
date: 2026-10-28
publishAt: 2026-10-28T08:00:00+02:00
lang: de
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

Ein Machine-Learning-Modell kann eine wichtige Frage beantworten und einem Nutzer trotzdem nicht sagen, was er tun soll.

**Payrithm** schätzt die Wahrscheinlichkeit, dass eine Rechnung verspätet bezahlt wird.

Angenommen, das Modell liefert:

```text
Rechnung A: 90% Risiko verspäteter Zahlung
Rechnung B: 65% Risiko verspäteter Zahlung
```

Wenn Payrithm nur ein Vorhersage-Dashboard wäre, würde eine Sortierung nach Wahrscheinlichkeit ausreichen.

Die eigentliche Produktfrage lautet jedoch:

> Welche Rechnung sollte das Forderungsmanagement zuerst bearbeiten?

Das sind keine gleichwertigen Probleme.

## Wahrscheinlichkeit misst Risiko, nicht Bedeutung

Betrachten wir:

| Rechnung | Wahrscheinlichkeit verspäteter Zahlung |   Betrag | Status             |
| -------- | -------------------------------------: | -------: | ------------------ |
| A        |                                    90% |    150 € | Fällig in 25 Tagen |
| B        |                                    65% | 48.000 € | Überfällig         |

Rechnung A hat das höhere vorhergesagte Risiko.

Rechnung B kann die höhere operative Priorität haben.

Ein Finanzteam verteilt seine Aufmerksamkeit nicht nur anhand der Wahrscheinlichkeit.

Auch der gefährdete Wert und die zeitliche Dringlichkeit sind relevant.

Deshalb hält Payrithm zwei Konzepte getrennt:

```text
ML-Vorhersage
      |
      v
Wahrscheinlichkeit verspäteter Zahlung


Geschäftsregel
      |
      v
Inkassopriorität
```

Das zweite verwendet das erste als Eingabe.

Es ersetzt es nicht.

## Das aktuelle Prioritätsmodell

Der erklärbare Prioritätsscore kombiniert vier normalisierte Signale:

\[
Priority =
0.45P(\text{late}) +
0.25A +
0.25U +
0.05R
\]

wobei:

- \(P\) = vorhergesagte Wahrscheinlichkeit verspäteter Zahlung,
- \(A\) = relativer Rechnungsbetrag,
- \(U\) = Dringlichkeit anhand des Fälligkeitsdatums,
- \(R\) = Erinnerungsdruck.

Die Gewichte drücken derzeit eine Produktpolitik aus:

```text
45% Risiko
25% Wert
25% Dringlichkeit
5% Erinnerungsaktivität
```

Die genauen Gewichte können sich weiterentwickeln.

Architektonisch ist entscheidend, dass sie sichtbar bleiben.

## Warum die Wahrscheinlichkeit das größte Gewicht erhält

Der Klassifikator für verspätete Zahlungen schätzt, ob eine Rechnung wahrscheinlich Aufmerksamkeit benötigt.

Das verdient einen erheblichen Einfluss.

Ihm jedoch 100% des Rankings zu geben, würde bedeuten:

> Für das Forderungsmanagement zählt nur die Wahrscheinlichkeit.

So funktionieren Finanzprozesse nicht.

Eine Rechnung über 100 € mit sehr hohem Risiko und eine Rechnung über 50.000 € mit moderatem Risiko führen zu unterschiedlichen Entscheidungen.

Der Machine-Learning-Score bleibt daher eine wichtige Eingabe, ohne mit dem vollständigen Geschäftsziel verwechselt zu werden.

## Rechnungswerte über Währungen hinweg vergleichen

Der Rohbetrag bringt ein weiteres Problem mit sich.

Diese Werte sind nicht direkt vergleichbar:

```text
10.000 EUR
10.000 USD
10.000 GBP
```

Payrithm tut nicht so, als wären sie identisch.

Ohne eine vertrauenswürdige Wechselkurspolitik verwendet die Prioritätsberechnung das **Betragsperzentil der Rechnung innerhalb ihrer eigenen Währung**.

Zum Beispiel:

```python
amount_percentile = (
    invoices
    .groupby("currency")["amount"]
    .rank(pct=True)
)
```

Die Frage lautet dann:

> Wie groß ist diese Rechnung im Vergleich zu anderen Rechnungen in derselben Währung?

So entsteht ein normalisiertes Signal zwischen null und eins, ohne einen Wechselkurs zu erfinden.

## Dringlichkeit ändert sich jeden Tag

Die Wahrscheinlichkeit verspäteter Zahlung wird aus Informationen zum Zeitpunkt der Ausstellung erzeugt.

Dringlichkeit ist operativ.

Eine Rechnung, die vor drei Wochen ausgestellt wurde, kann sich jetzt ihrem Fälligkeitsdatum nähern.

Eine andere kann bereits überfällig sein.

Payrithm berechnet die Fälligkeitsdringlichkeit deshalb getrennt vom Modell.

Eine vereinfachte Funktion ist:

```python
days_to_due = (due_date - today).days

urgency = min(
    1.0,
    max(0.0, (30 - days_to_due) / 30),
)
```

Eine Rechnung, deren Fälligkeit weit entfernt ist, erhält eine geringe Dringlichkeit.

Je näher der Termin rückt, desto höher wird die Dringlichkeit.

Ist die Rechnung überfällig, bleibt das Signal hoch.

Dieses Signal sollte nicht in den Klassifikator zum Ausstellungszeitpunkt einfließen, weil es zum Vorhersagezeitpunkt noch nicht existierte.

Es gehört in die operative Schicht.

## Erinnerungsdruck gehört ebenfalls dorthin

Das gleiche Argument gilt für Mahnungen und Erinnerungen.

Wie viele Erinnerungen bereits versendet wurden, ist nützlich, wenn heute entschieden werden soll, was zu tun ist.

Es ist keine gültige Information, um das Risiko am Tag der Rechnungsausstellung vorherzusagen.

Payrithm kann die aktuelle Erinnerungsaktivität beispielsweise normalisieren:

```python
reminder_pressure = min(
    1.0,
    reminders_sent / 3,
)
```

und in den Prioritätsscore aufnehmen.

Modell und Workflow arbeiten damit auf unterschiedlichen Zeitpunkten.

## Warum ich nicht mit einem zweiten Black-Box-Rankingmodell begonnen habe

Es wäre möglich, ein weiteres Modell zu trainieren, das einen Inkasso-Prioritätsscore erzeugt.

Bewusst war das nicht mein erster Entwurf.

Eine operative Warteschlange muss beantworten können:

> Warum steht diese Rechnung über jener?

Mit der aktuellen Formel ist die Antwort sichtbar:

```text
hohes vorhergesagtes Risiko
+
große Rechnung relativ zu ihrer Währung
+
bereits überfällig
+
mehrere vorherige Erinnerungen
```

Der Nutzer braucht kein komplexes Erklärungssystem, um die Reihenfolge der Warteschlange zu verstehen.

Diese Einfachheit hat einen Wert.

## Richtlinien können sich ändern, ohne das Modell neu zu trainieren

Die Trennung macht das System außerdem anpassungsfähig.

Stellen wir uns ein Unternehmen vor, das vorübergehend unter Liquiditätsdruck gerät.

Dann kann der Rechnungswert wichtiger werden.

Die Prioritätspolitik könnte sich von:

```text
Risiko:          45%
Betrag:          25%
Dringlichkeit:   25%
Erinnerungen:     5%
```

zu einer stärkeren Gewichtung des Betrags verschieben.

Der Klassifikator für verspätete Zahlungen muss nicht neu trainiert werden.

Am Zahlungsverhalten der Kunden hat sich nichts geändert.

Nur die aktuelle Entscheidungsstrategie des Unternehmens hat sich verändert.

Das ist eine nützliche Unterscheidung:

> Modelle beschreiben die Welt. Entscheidungsregeln beschreiben, was wir damit tun wollen.

Sie sollten nicht automatisch dasselbe Artefakt sein.

## Kalibrierung wird wichtiger, wenn Wahrscheinlichkeit in eine Formel eingeht

Payrithm bewertet die Qualität von Wahrscheinlichkeiten mit ROC-AUC, Kalibrierungsanalyse und Brier Score.

Kalibrierung ist hier wichtig, weil die Wahrscheinlichkeit nicht nur zum Sortieren verwendet wird.

Sie erhält ein numerisches Gewicht in einer nachgelagerten Entscheidung.

Wenn ein Modell 0,90 für Ereignisse ausgibt, die tatsächlich nur in 60% der Fälle eintreten, übergewichtet die Prioritätsformel das Risiko.

Deshalb sind mir beide Aspekte wichtig:

```text
Rankingqualität
und
Wahrscheinlichkeitsqualität
```

Ein Modell mit hoher Trennschärfe, aber schlechter Kalibrierung kann nachgelagerte Entscheidungen trotzdem verzerren.

## Erklärbarkeit existiert auf zwei Ebenen

Im System gibt es eigentlich zwei Arten von Erklärungen.

Die erste lautet:

> Warum hat das Modell eine hohe Wahrscheinlichkeit vorhergesagt?

Das lässt sich über Modelldiagnostik und Feature-Interpretation untersuchen.

Die zweite lautet:

> Warum steht diese Rechnung ganz oben in der Inkasso-Warteschlange?

Diese Erklärung ist deutlich einfacher.

Die Prioritätskomponenten selbst liefern sie.

Ein Nutzer könnte sehen:

```text
Risiko verspäteter Zahlung  0.82
Relativer Betrag            0.91
Fälligkeitsdringlichkeit    1.00
Erinnerungsdruck             0.67
--------------------------------
Prioritätsscore              ...
```

Die Geschäftsentscheidung bleibt nachvollziehbar.

## Vorhersage ist nicht Entscheidungsfindung

Dieses Muster gilt weit über Forderungsmanagement hinaus.

Ein Betrugsmodell kann die Betrugswahrscheinlichkeit schätzen, ohne die gesamte Untersuchungsliste festzulegen.

Ein Wartungsmodell kann ein Ausfallrisiko schätzen, ohne zu entscheiden, wann eine Anlage abgeschaltet werden sollte.

Die architektonische Lehre, die ich deshalb in Payrithm übernommen habe, ist allgemeiner:

> Ein ML-Ergebnis sollte oft eine Eingabe in ein explizites Entscheidungssystem sein, nicht die endgültige Entscheidung selbst.

Die Aufgabe des Klassifikators ist es, das Zahlungsrisiko so genau und ehrlich wie möglich zu schätzen.

Die Aufgabe der Prioritätsschicht ist es, dieses Risiko in den heutigen operativen Kontext zu übersetzen.

Diese Verantwortlichkeiten getrennt zu halten, macht beide leichter zu bewerten, zu ändern und zu erklären.
