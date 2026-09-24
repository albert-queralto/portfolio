---
title: "Spanische Energiedaten-Pipeline"
description: "Eine automatisierte Pipeline, die spanische Strompreis- und Erneuerbare-Energien-Daten erfasst und strukturierte Ergebnisse für Analysen speichert."
lang: de
translationKey: spanish-energy-pipeline
order: 6
featured: false
draft: false
status: "Completed"
category: "Data Science"
focus: "Daten-Ingestion · Automatisierung"
image: "/web_scraping_esios.png"
source: "https://github.com/albert-queralto/scraping-energy-prices-spain"
technologies:
  - Python
  - REST API
  - PostgreSQL
  - Selenium
metrics:
  - label: "Pipeline-Typ"
    value: "Automatisierte Ingestion"
  - label: "Speicher"
    value: "PostgreSQL"
  - label: "Erfassung"
    value: "REST-APIs + Browserautomatisierung"
---

## Problem

Strommarktanalysen benötigen konsistente historische Daten aus mehreren Quellen. Öffentliche Energieinformationen sind jedoch häufig über APIs, herunterladbare Dateien und interaktive Webseiten verteilt.

Dieses Projekt automatisiert die Erfassung spanischer Strompreis- und Erneuerbaren-Erzeugungsdaten und speichert sie in einer strukturierten Datenbank, damit Analysten mit einem wiederholbar erzeugbaren Datensatz statt manueller Datensammlung arbeiten können.

## Einschränkungen

Externe Quellen können Schemata, Seitenstrukturen, Identifikatoren oder Verfügbarkeit ohne Vorankündigung ändern. Einige Informationen sind über REST-APIs verfügbar, andere erfordern Browserautomatisierung.

Zeitzonen, Zeitstempel, doppelte Beobachtungen, fehlende Perioden und inkonsistente Einheiten müssen sorgfältig behandelt werden. Erneute Pipeline-Läufe dürfen weder Duplikate erzeugen noch bereits gesammelte Historie beschädigen.

Zugangsdaten und anbieterspezifische Konfiguration müssen außerhalb des Repositories bleiben.

## Ansatz

Python-Ingestion-Jobs rufen Daten über verfügbare REST-Endpunkte ab und verwenden Selenium, wenn Browserinteraktion erforderlich ist. Antworten werden in normalisierte Datensätze überführt, bevor sie in PostgreSQL geschrieben werden.

Die Pipeline trennt Extraktion, Transformation, Validierung und Persistenz. Dadurch lässt sich quellenspezifische Logik leichter ersetzen und Datenqualität kann vor Datenbankwrites geprüft werden.

Datenbanktabellen bilden eine stabile analytische Schicht für spätere Visualisierung, statistische Analyse und Modellentwicklung.

## Validierung

Jeder Lauf prüft Pflichtfelder, Zeitstempel-Parsing, numerische Konvertierung, erwartete Einheiten und doppelte Schlüssel. Die Vollständigkeit von Datumsbereichen kann untersucht werden, um fehlende stündliche oder tägliche Beobachtungen zu finden.

Datenbankabfragen stellen sicher, dass Wiederholungen idempotent sind und Zeilenanzahl sowie Datumsgrenzen dem angeforderten Extraktionszeitraum entsprechen. Quellsummen oder ausgewählte Beobachtungen können manuell mit dem Originalanbieter verglichen werden.

Fehler müssen explizit sichtbar sein, damit partielle Extraktionen nicht mit vollständigen Daten verwechselt werden.

## Engineering-Entscheidungen

PostgreSQL dient als persistenter analytischer Speicher, weil es zuverlässige Constraints, Indizes, Datumsabfragen und Integration mit Python-Werkzeugen bietet.

API-Zugriff wird bevorzugt, wenn verfügbar, da er stabiler als Scraping ist. Selenium bleibt auf Quellen beschränkt, die Browserverhalten erfordern, wodurch der fragilste Teil der Pipeline isoliert wird.

Der Code ist um Quelladapter und wiederholbare Ausführung organisiert statt um einen einzigen Notebook-Workflow.

## Abwägungen

Browserautomatisierung verursacht Wartungsaufwand und kann bei Webseitenänderungen brechen. Eine Produktionspipeline würde Wiederholungsversuche, strukturiertes Logging, Alerting und stärkere Quellverträge ergänzen.

Das Projekt konzentriert sich auf Ingestion und Speicherung statt Orchestrierung auf Enterprise-Skala. Ein vollständiger Datenkatalog, Lineage-System oder verteilte Verarbeitungsschicht sind noch nicht enthalten.

## Nächste Schritte

Die Pipeline könnte mit Apache Airflow oder einem anderen Orchestrator geplant werden, ergänzt um automatische Warnungen bei fehlenden Perioden, Schemaänderungen und wiederholten Fehlern.

Weitere Verbesserungen umfassen containerisierte Ausführung, migrationsverwaltete Datenbankschemata, Datenqualitätsberichte, inkrementelle Backfills, Integrationstests gegen Beispielantworten und ein öffentliches Dashboard auf Basis der gespeicherten Daten.
