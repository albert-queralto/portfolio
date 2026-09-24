---
title: "Sensorfehlererkennung und -lokalisierung mit RNNs"
description: "Eine Pipeline mit rekurrenten neuronalen Netzen und LSTM-/GRU-Modellen zur Erkennung und Lokalisierung von Fehlern in multivariaten Sensorströmen."
lang: de
translationKey: sensor-error-detection
order: 3
featured: false
draft: false
status: "Completed"
category: "Machine Learning"
focus: "Deep Learning · Zeitreihen"
image: "/Sensor_Error_Detection_and_Localization_with_RNNs.png"
source: "https://github.com/albert-queralto/Sensor_Error_Detection_and_Localization_with_RNNs"
technologies:
  - Python
  - PyTorch
  - LSTM
  - GRU
  - Time series
metrics:
  - label: "Problemtyp"
    value: "Multivariate Fehlererkennung"
  - label: "Modellfamilien"
    value: "LSTM + GRU"
  - label: "Ausgabe"
    value: "Erkennung + Lokalisierung"
---

## Problem

Industrielle und ökologische Monitoringsysteme stützen sich auf mehrere Sensoren, die über die Zeit korrelierte Messwerte erzeugen. Ein fehlerhafter Sensor kann nachgelagerte Analysen verfälschen, Fehlalarme auslösen oder ein reales Betriebsereignis verdecken.

Das Projekt untersucht, wie rekurrente neuronale Netze erkennen können, wann ein Sensorstrom anomal wird, und welcher Sensor dafür verantwortlich ist. Zielgruppe sind Ingenieure und Analysten, die zuverlässige multivariate Monitoringsysteme betreiben.

## Einschränkungen

Sensorfehler sind zeitliche Phänomene und keine isolierten tabellarischen Ereignisse. Ein verdächtiger Wert lässt sich möglicherweise erst aus seiner Beziehung zu früheren Beobachtungen und zum gleichzeitigen Verhalten anderer Sensoren erkennen.

Fehlerbeispiele können deutlich seltener sein als normale Beobachtungen und damit ein unausgewogenes Lernproblem erzeugen. Verschiedene Fehlertypen können zudem ähnliche Symptome zeigen, und derselbe Sensor kann sich unter wechselnden Betriebsbedingungen unterschiedlich verhalten.

Das Projekt ist experimentell und kein bereitgestellter Monitoringdienst. Die Evaluation konzentriert sich daher auf Modellverhalten und vergleichende Leistung statt auf Produktionslatenz oder Infrastrukturverfügbarkeit.

## Ansatz

Die Daten werden als multivariate Sequenzen für rekurrente neuronale Netze organisiert. LSTM- und GRU-Architekturen lernen zeitliche Abhängigkeiten sowie Beziehungen zwischen Sensoren.

Die Pipeline trennt zwei verwandte Aufgaben: die Erkennung, ob eine Sequenz einen Sensorfehler enthält, und die Lokalisierung des betroffenen Sensors. Die Datenaufbereitung umfasst Sequenzbildung, Feature-Skalierung, Zielgenerierung und die Trennung von Training und Evaluation.

Der Vergleich von LSTM- und GRU-Modellen hilft zu beurteilen, ob die zusätzliche Gating-Komplexität eines LSTM für die ausgewählten Daten und Sequenzlängen einen ausreichenden Vorteil bietet.

## Validierung

Die Modelle werden auf zurückgehaltenen Sequenzen evaluiert, die nicht im Training verwendet wurden. Bewertet wird sowohl, ob Fehler erkannt werden, als auch, ob der richtige Sensor identifiziert wird.

Da normale Beobachtungen den Datensatz dominieren können, sind klassensensitive Kennzahlen aussagekräftiger als Accuracy allein. Konfusionsmatrizen und klassenweises Verhalten zeigen, ob ein Modell über Sensoren hinweg gut arbeitet oder hauptsächlich häufige Fehlermuster erkennt.

Das Repository enthält die reproduzierbare Analyse und die Modellexperimente zum Vergleich von Architekturen und Trainingskonfigurationen.

## Engineering-Entscheidungen

PyTorch wird verwendet, um rekurrente Architekturen und Trainingsschleifen explizit zu definieren. Dadurch bleiben Hidden-State-Handling, Sequenzformen, Optimierung und Evaluationsverhalten sichtbar, statt hinter einer höheren Abstraktion verborgen zu sein.

Datenaufbereitung, Modelldefinition, Training und Evaluation bleiben logisch getrennt, sodass einzelne Stufen inspiziert und verändert werden können. Reproduzierbare Konfiguration und feste Zufallsseeds sind beim Vergleich rekurrenter Modelle wichtig.

Visuelle Diagnosen ergänzen zusammenfassende Metriken, um Trainingsverhalten und Modellfehler zu untersuchen.

## Abwägungen

Das Projekt konzentriert sich auf LSTM- und GRU-Architekturen, statt jede mögliche Zeitreihenmethode zu testen. Einfachere statistische Baselines und neuere Sequenzarchitekturen könnten zusätzliche hilfreiche Vergleiche liefern.

Die experimentelle Pipeline enthält noch keine Streaming-Inferenz-API, kein persistentes Modellregister, keine automatisierte Drift-Erkennung und keine operatororientierte Alarmoberfläche.

## Nächste Schritte

Eine stärkere nächste Version würde nicht-rekurrente Baselines, zeitliche Cross-Validation, Schwellenwertoptimierung und einen klareren Vergleich zwischen Erkennungs- und Lokalisierungsfehlern ergänzen.

Für den Produktionseinsatz könnte das Modell hinter einem FastAPI-Dienst bereitgestellt, an eine Streaming-Datenquelle angebunden, auf Data Drift überwacht und in eine Alarmoberfläche integriert werden, die den betroffenen Sensor und unterstützende Evidenz anzeigt.
