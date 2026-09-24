---
title: "Payrithm"
description: "Eine Accounts-Receivable-Intelligence-Plattform, die verspätete Zahlungen prognostiziert, Zahlungszeitpunkte schätzt, Zahlungseingänge vorhersagt und Inkassoarbeit priorisiert."
lang: de
translationKey: payrithm
order: 1
featured: true
draft: false
status: "In progress"
category: "Machine Learning"
focus: "ML-SaaS · Finanzoperationen"
image: "/projects/payrithm/payrithm.png"
ogImage: "/og/payrithm.png"
article: "/blog/payrithm/"
source: "https://github.com/albert-queralto/invoice-late-predictor-enterprise"
preview: "https://payrithm.albertqueralto.dev/"
technologies:
  - Python
  - FastAPI
  - scikit-learn
  - React
  - TypeScript
  - PostgreSQL
  - Celery
  - Redis
  - Docker
metrics:
  - label: "Prognoseaufgaben"
    value: "Klassifikation + Regression"
  - label: "Validierung"
    value: "Chronologisches Holdout"
  - label: "Architektur"
    value: "Multi-Service-SaaS"
---

## Das Problem

Debitorenteams müssen möglicherweise Hunderte oder Tausende offene Rechnungen verwalten, ohne zu wissen, welche mit hoher Wahrscheinlichkeit verspätet bezahlt werden.

Alle Rechnungen gleich zu behandeln verschwendet Inkassokapazität. Payrithm soll Risiko früh erkennen und in eine klare operative Warteschlange überführen.

## Mein Ansatz

Payrithm verwendet zwei zusammenhängende Machine-Learning-Modelle:

- Ein Klassifikator schätzt die Wahrscheinlichkeit einer verspäteten Zahlung.
- Ein Regressor schätzt die Zahlungsverzögerung relativ zum Fälligkeitsdatum.

Das System trennt Merkmale, die zum Ausstellungszeitpunkt bekannt sind, von aktuellen operativen Signalen. Dadurch gelangen aktueller Überfälligkeitsstatus, zukünftige Mahnungen und endgültige Zahlungsinformationen nicht als Data Leakage in das Modelltraining.

## Datenaufbereitung

Die Importpipeline validiert Kennungen, Rechnungsbeträge, Währungen, Ausstellungsdaten, Fälligkeitsdaten und Zahlungsdaten, bevor Datensätze zu Trainingsbeispielen werden.

Kundenhistorienmerkmale werden so rekonstruiert, wie sie am Ausstellungsdatum jeder Rechnung bekannt waren. Nur Ergebnisse, die vor diesem Datum bereits bekannt waren, werden einbezogen.

## Validierung

Der jüngste Teil der abgeschlossenen Rechnungen bildet den Evaluationszeitraum. Frühere Rechnungen bilden den Trainingszeitraum.

Dieser chronologische Split reproduziert die reale Deployment-Richtung: auf der Vergangenheit trainieren und zukünftige Rechnungen prognostizieren.

Der Klassifikator wird bewertet mit:

- ROC-AUC für Rankingqualität
- Brier Score für Wahrscheinlichkeitsqualität
- Kalibrierungsanalyse
- Einer Baseline mit konstanter Wahrscheinlichkeit

Das Regressionsmodell wird anhand des mittleren absoluten Fehlers und einer Median-Delay-Baseline bewertet.

## Vorhersagen in Entscheidungen übersetzen

Der endgültige Inkasso-Prioritätsscore kombiniert:

- Wahrscheinlichkeit verspäteter Zahlung
- Betragsperzentil innerhalb der jeweiligen Währung
- Dringlichkeit des Fälligkeitsdatums
- Mahndruck

Die Trennung dieser Formel vom Modell hält Geschäftsregeln flexibel und ermöglicht Nutzern nachzuvollziehen, warum eine Rechnung weit oben in der Warteschlange erscheint.

## Architektur

Die Anwendung trennt Frontend, API, Anwendungsdienste, Hintergrund-Worker, Persistenzschicht und Machine-Learning-Pipeline.

Dadurch können Importe und Modelltraining asynchron laufen, während die API reaktionsfähig bleibt.

## Aktueller Stand

Die wichtigsten Anwendungsmodule sind implementiert. Die nächsten Schritte sind die Vervollständigung der Produktionsevaluation, Veröffentlichung finaler Modellmetriken, Ausbau des Monitorings und das Einholen von Feedback potenzieller Nutzer.
