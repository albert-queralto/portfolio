---
title: "Adipositas-Dashboard"
description: "Ein interaktives Dashboard zur Untersuchung globaler Adipositasmuster und demografischer Unterschiede mit einem Python-Analytics-Stack."
lang: de
translationKey: obesity-dashboard
order: 5
featured: false
draft: false
status: "Deployed"
category: "Data Science"
focus: "Interaktive Analytik"
image: "/obesitydashboard.png"
source: "https://github.com/albert-queralto/dashboard_obesity_analysis"
preview: "https://dashboard-obesity-analysis.onrender.com/"
technologies:
  - Python
  - Bokeh
  - Pandas
  - Render
metrics:
  - label: "Ausgabe"
    value: "Interaktives Dashboard"
  - label: "Analyseschwerpunkt"
    value: "Globale und demografische Muster"
  - label: "Deployment"
    value: "Render"
---

## Problem

Adipositasdaten enthalten mehrere geografische, demografische und zeitliche Dimensionen, die sich aus statischen Tabellen allein nur schwer erschließen lassen. Das Projekt überführt den Datensatz in ein interaktives Dashboard, mit dem Nutzer Muster untersuchen und Bevölkerungsgruppen visuell vergleichen können.

Zur Zielgruppe gehören Analysten, Studierende und Akteure im öffentlichen Gesundheitswesen, die Unterschiede auf zugängliche Weise untersuchen möchten, ohne selbst Code schreiben zu müssen.

## Einschränkungen

Gesundheitsdatensätze kombinieren häufig Kategorien, Regionen, Altersgruppen und Berichtszeiträume mit unvollständiger oder ungleichmäßiger Abdeckung. Vergleiche können irreführend werden, wenn Unterschiede in Populationsdefinitionen oder Datenverfügbarkeit übersehen werden.

Ein öffentliches Dashboard muss außerdem analytische Flexibilität, schnelle Ladezeiten und eine einfache Oberfläche ausbalancieren. Die Anwendung läuft auf einem Hosting-Tarif mit begrenzten Ressourcen, daher sollten aufwendige Transformationen nicht bei jeder Interaktion unnötig wiederholt werden.

Das Projekt ist explorativ und darf weder als medizinische Beratung noch als kausale Analyse von Adipositas verstanden werden.

## Ansatz

Pandas dient zur Bereinigung, Umformung, Filterung und Zusammenfassung der Quelldaten. Bokeh stellt verknüpfte interaktive Diagramme und Steuerelemente bereit, sodass geografische und demografische Muster innerhalb derselben Anwendung untersucht werden können.

Die Oberfläche betont explorative Vergleiche statt einer einzigen festen Schlussfolgerung. Nutzer können ausgewählte Dimensionen verändern und beobachten, wie Verteilungen und Trends darauf reagieren.

Die Datenaufbereitung erfolgt vor der Visualisierung, damit Diagramm-Callbacks auf konsistenten, analysebereiten Strukturen arbeiten.

## Validierung

Der transformierte Datensatz wird hinsichtlich erwarteter Kategorien, fehlender Werte und Aggregatkonsistenz mit der Quelle abgeglichen. Repräsentative Filter werden getestet, um sicherzustellen, dass Steuerelemente das richtige Teilset aktualisieren und Diagrammbeschriftungen mit den ausgewählten Daten synchron bleiben.

Die visuelle Validierung umfasst Achsen, Legenden, Einheiten, Leerezustände und responsives Verhalten. Extremwerte und fehlende Werte werden geprüft, damit Diagrammbereiche nicht unbemerkt verzerrt werden.

Die bereitgestellte Anwendung liefert abschließend einen Integrationstest für Startverhalten und Asset-Laden in der Hosting-Umgebung.

## Engineering-Entscheidungen

Bokeh wurde gewählt, weil es Python-basierte interaktive Visualisierung ohne separates JavaScript-Frontend ermöglicht. So bleiben Analyse- und UI-Logik nahe am Datenverarbeitungscode.

Das Projekt trennt Datenaufbereitung und Dashboard-Aufbau, sodass Änderungen am Datensatz nicht jede Visualisierung neu erforderlich machen. Das Hosting auf Render macht die Anwendung direkt über das Portfolio zugänglich.

Das Repository enthält Quellcode und Umgebungsdefinition, die zur Reproduktion des Dashboards benötigt werden.

## Abwägungen

Das Dashboard bevorzugt explorative Klarheit gegenüber einer großen Anzahl von Diagrammen. Es versucht weder kausale Beziehungen nachzuweisen noch ein prädiktives Gesundheitsmodell zu erstellen.

Eine Python-gehostete interaktive Anwendung ist bequem, kann aber langsamere Kaltstarts als eine vollständig statische Visualisierung haben. Umfangreicheres Caching oder vorberechnete Extrakte könnten bei größeren Datensätzen die Reaktionszeit verbessern.

## Nächste Schritte

Künftige Arbeiten könnten klarere Dokumentation der Datenquellen, den Download gefilterter Daten, Konfidenzintervalle soweit verfügbar, ausführlichere Accessibility-Beschreibungen und automatisierte Tests für Transformationen und Callbacks ergänzen.

Ein statischer Zusammenfassungsmodus könnte die initiale Ladezeit verbessern. Eine ausführlichere Methodikseite könnte zusätzlich die Grenzen länderübergreifender und demografischer Vergleiche erläutern.
