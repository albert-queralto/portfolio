---
title: "Analyse spanischer Energiepreise"
description: "Explorative und statistische Analyse spanischer Strommarktpreise, saisonaler Muster und potenzieller Preistreiber."
lang: de
translationKey: spanish-energy-analysis
order: 8
featured: false
draft: false
status: "Completed"
category: "Data Science"
focus: "EDA · Statistische Modellierung"
image: "/energy_prices.png"
source: "https://github.com/albert-queralto/analysis_energy_prices"
technologies:
  - Python
  - Pandas
  - Matplotlib
  - Statsmodels
metrics:
  - label: "Analysetyp"
    value: "Explorativ + statistisch"
  - label: "Hauptdomäne"
    value: "Spanischer Strommarkt"
  - label: "Zeitlicher Fokus"
    value: "Saisonalität und Preistreiber"
---

## Problem

Strompreise variieren mit Nachfrage, Erzeugungsmix, Saisonalität, Marktbedingungen und externen Ereignissen. Reine Zeitreihenwerte erklären nicht, wann Preise sich verändern oder welche Faktoren sich gemeinsam bewegen könnten.

Dieses Projekt analysiert Preise des spanischen Strommarktes, um zeitliche Muster zu identifizieren, volatile Phasen sichtbar zu machen und Beziehungen zu möglichen erklärenden Variablen zu untersuchen.

Die Arbeit dient als analytische Grundlage für Reporting, Forecasting und weiterführende Energiemarktforschung.

## Einschränkungen

Energiezeitreihen besitzen starke zeitliche Abhängigkeiten, mehrere saisonale Zyklen, Ausreißer, fehlende Perioden und Strukturbrüche. In explorativer Analyse beobachtete Beziehungen bedeuten nicht automatisch Kausalität.

Variablen können unterschiedliche Frequenzen oder Zeitstempel verwenden und müssen vor einem Vergleich ausgerichtet werden. Preisverteilungen können stark schief sein, weshalb Mittelwerte allein nicht ausreichen.

Jede prädiktive Interpretation muss die chronologische Reihenfolge respektieren und darf nicht auf zufälligen Train/Test-Splits beruhen.

## Ansatz

Pandas wird zum Bereinigen, Ausrichten, Aggregieren und Umformen der Daten eingesetzt. Matplotlib unterstützt Zeitreihen-, Verteilungs- und Beziehungsvisualisierungen, während Statsmodels statistische Werkzeuge für Trend- und Zeitanalysen bereitstellt.

Die Analyse beginnt mit Datenqualitätsprüfungen und deskriptiver Statistik und untersucht anschließend stündliches, tägliches, monatliches und saisonales Verhalten. Mögliche Treiber werden mittels Diagrammen und statistischen Zusammenfassungen mit Preisbewegungen verglichen.

Der Workflow unterscheidet explorative Beobachtungen von stärkeren statistischen Aussagen und dokumentiert Annahmen, die während der Transformation getroffen werden.

## Validierung

Datumsbereiche, Frequenzen, fehlende Zeitstempel, Duplikate und Einheiten werden vor der Analyse geprüft. Aggregierte Werte werden mit den zugrunde liegenden Beobachtungen verglichen, damit Transformationen die beabsichtigte Bedeutung erhalten.

Wo Vorhersage eingesetzt wird, werden statistische Modelle anhand des Residuenverhaltens und zeitgerechter Validierung untersucht. Bei der Interpretation von Kennzahlen wird die Sensitivität gegenüber Ausreißern und ungewöhnlichen Marktperioden berücksichtigt.

Diagramme werden auf irreführende Skalen, inkonsistente Zeitaggregation und versehentliches Mischen von Variablen mit unterschiedlichen Einheiten überprüft.

## Engineering-Entscheidungen

Das Projekt ist als reproduzierbare Python-Analyse strukturiert und nicht als Sammlung voneinander unabhängiger manueller Berechnungen. Datenaufbereitung ist von Visualisierung und Modellierung getrennt, sodass derselbe bereinigte Datensatz mehrere analytische Perspektiven unterstützt.

Statsmodels wird dort eingesetzt, wo interpretierbare statistische Ausgaben wertvoller sind als ein Black-Box-Prädiktor. Quellcode und Abbildungen werden im Repository versioniert.

Das Projekt ergänzt die separate Energie-Ingestion-Pipeline, die Datenerfassung und Persistenz übernimmt.

## Abwägungen

Die Analyse priorisiert Interpretierbarkeit und Exploration statt eines produktiven Forecasting-Dienstes. Sie behauptet nicht, dass korrelierte Variablen kausale Treiber sind.

Externe erklärende Daten und wichtige Marktinterventionen sind möglicherweise nicht vollständig abgebildet. Eine umfassendere Analyse würde reichhaltigere exogene Variablen und eine explizite Behandlung von Regimewechseln erfordern.

## Nächste Schritte

Die nächste Stufe könnte die Analyse mit der automatisierten Ingestion-Pipeline verbinden und so einen kontinuierlich aktualisierten Datensatz samt Dashboard schaffen.

Weitere Arbeiten könnten Zeitreihen-Forecasting-Baselines, Rolling-Origin-Evaluation, Unsicherheitsintervalle, Analysen von Regimewechseln und Vergleiche zwischen klassischen statistischen Modellen und Gradient-Boosting-Ansätzen ergänzen.
