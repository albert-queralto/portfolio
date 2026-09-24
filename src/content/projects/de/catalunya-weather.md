---
title: "Wetterportal für Katalonien"
description: "Ein authentifiziertes React-Portal für die Wetterplanung in Katalonien mit Meteocat-Stationshistorie, kartenbasierten Warnungen, Luftqualitätssignalen und Aktivitätsempfehlungen."
lang: de
translationKey: catalunya-weather
order: 4
featured: false
draft: false
status: "Deployed"
category: "Web"
focus: "Wetterplanungsportal"
image: "/catalunya_weather_app.png"
source: "https://github.com/albert-queralto/catalunya_weather_app"
preview: "https://catalonia-weather-app.albertqueralto.dev"
technologies:
  - TypeScript
  - React
  - Python
  - FastAPI
  - Leaflet
  - Recharts
metrics:
  - label: "Produkttyp"
    value: "Authentifiziertes Planungsportal"
  - label: "Datensignale"
    value: "Meteocat, Prognosen, Luftqualität"
  - label: "Oberflächen"
    value: "Karten, Diagramme, Empfehlungssystem"
---

## Problem

Wetterentscheidungen in Katalonien hängen oft von mehr als einer einzelnen Vorhersage ab. Ein nützliches Planungswerkzeug muss Meteocat-Stationsbeobachtungen, regionale Warnungen, lokale Luftqualitätssignale und praktischen Aktivitätskontext an einem Ort zusammenführen.

Dieses Projekt verwandelt diese fragmentierten Signale in ein Wetterplanungsportal. Die öffentliche Seite präsentiert das Produkt als zentrale Oberfläche für regionale Prognosen, Luftqualität, Meteocat-Warnungen und wetterabhängige Aktivitätsentscheidungen in Katalonien.

## Einschränkungen

Die Anwendung hängt von mehreren Live- und historischen Datenquellen ab. Sie muss daher fehlende Stationswerte, nicht verfügbare stündliche Luftqualitätsbeobachtungen, warnungsfreie Zeiträume, Upstream-Ausfälle und Meteocat-Rate-Limits behandeln.

Kartenbasierte Workflows bringen geografische Komplexität mit sich: Koordinaten, Stationsmetadaten, Comarca-Grenzen, Vergleiche benachbarter Stationen und vom Nutzer ausgewählte Orte müssen über Diagramme, Steuerelemente und Empfehlungsergebnisse hinweg synchron bleiben.

Auch Authentifizierung spielt eine Rolle. Das Portal umfasst Login, Registrierung, Profile, geschützte Nutzerabläufe und adminorientierte Ansichten. API-Aufrufe müssen daher Token-Zustand bewahren und Fehler gleichzeitig sichtbar und behebbar halten.

## Ansatz

Das bereitgestellte Frontend ist eine Vite-React-/TypeScript-Anwendung mit React Router, Material UI, Leaflet/react-leaflet und Recharts. Ein gemeinsamer API-Client kommuniziert mit einem `/api/v1`-Backend, sodass Funktionsseiten JSON-Daten über konsistente Fetch- und Fehlerbehandlungspfade abrufen.

Der authentifizierte Hauptablauf konzentriert sich auf ein Aktivitätsempfehlungssystem. Nutzer können einen Ort manuell oder per Browser-Geolokalisierung wählen, Radius, Prognosehorizont, Planungsfenster, Ergebnislimit und Luftqualitätssensitivität anpassen und anschließend nahe Empfehlungen auf einer Leaflet-Karte sehen.

Die Stationswerkzeuge stellen Meteocat-Daten sowohl über einen Stationsexplorer als auch über eine Katalonienkarte bereit. Nutzer können Stationen, Variablen und Datumsbereiche wählen, Trends, tägliche Min/Avg/Max-Diagramme, Missing-Data-Indikatoren, Vergleiche benachbarter Stationen, Mikroklima-Einblicke und Zusammenfassungen der Prognosegenauigkeit untersuchen.

Zusätzlich enthält das Portal eine Luftqualitätskarte für PM2.5, PM10, CO, CO2, NO2, SO2, Ozon und UV-Index sowie eine Ansicht der Meteocat-SMP-Episoden, die Comarques entsprechend der Warnstufe für heute und morgen einfärbt.

## Validierung

Die Validierung deckt Routenzugriff, Token-Persistenz, Login- und Registrierungsabläufe, geschützte Nutzeransichten und ausgewählte Adminoperationen ab. API-Antworten müssen klar fehlschlagen, wenn externe Wetterdienste leere Daten, ungültige Payloads oder Quotenfehler liefern.

Wetterspezifische Prüfungen umfassen repräsentative Meteocat-Stationen, Stationsvariablen, Datumsbereiche, fehlende Intervalle, Luftschadstoffe, offene SMP-Warnperioden, Karten-Overlays und Empfehlungsdurchläufe mit unterschiedlichen Radien und Planungsfenstern.

Frontend-Validierung konzentriert sich auf Lade- und Leerezustände, Diagrammformatierung, Markerpositionen, Comarca-Färbung, Gruppierung von Empfehlungen und darauf, ob Feedback-Ereignisse den Wetter- und Rankingkontext für spätere Analysen enthalten.

## Engineering-Entscheidungen

React Router trennt das Portal in öffentliche, authentifizierte und adminorientierte Abläufe. Material UI sorgt für konsistente Formulare, Buttons, Chips, Modals und Navigationselemente über eine große Funktionsfläche hinweg.

Leaflet wird für interaktive Karten eingesetzt, weil Stationsauswahl, Nutzerstandort, Comarca-Overlays und Schadstoffmarker Kerninteraktionen statt dekorativer Elemente sind. Recharts übernimmt Stationshistorien, stündliche Luftqualitätsreihen, Missing-Data-Zusammenfassungen und Vergleiche der Prognosegenauigkeit.

Die Backend-API bleibt die Anti-Corruption-Layer um Meteocat, Luftqualität, Empfehlungen, Nutzer und Modellendpunkte. Serverseitige Integrationen erleichtern Schema-Normalisierung, schützen Provider-Konfiguration und ermöglichen späteres Caching oder Austauschen externer Dienste.

## Abwägungen

Die aktuelle Version priorisiert ein integriertes Planungserlebnis gegenüber tiefer meteorologischer Modellierung. Sie verbindet nützliche Signale für Alltagsentscheidungen, darf aber nicht als offizielles Warnsystem oder Ersatz für primäre Meteocat-Hinweise verstanden werden.

Live-Karten, Stationsmetadaten, historische Werte, Warnungen und Luftqualitätsbeobachtungen geben der Oberfläche Breite, erzeugen aber Latenz und Rate-Limit-Druck. Stärkeres Caching und vorberechnete Zusammenfassungen würden die Robustheit verbessern.

Die Empfehlungsschleife erfasst Nutzeraktionen wie Ansichten, Speichern, Abschließen, Verwerfen und Bewertungen. Die Qualität der Personalisierung hängt jedoch von weiter wachsendem Ereignisvolumen und sorgfältiger Evaluation des Rankingverhaltens ab.

## Nächste Schritte

Die nächste Version sollte automatisierte API- und Browsertests, stärkeren Routenschutz für alle reinen Adminansichten, Response-Caching, Deployment-Dokumentation und Monitoring von Upstream-Ausfällen hinzufügen.

Weitere Verbesserungen könnten gespeicherte Orte, Benachrichtigungspräferenzen, umfangreichere Accessibility-Prüfungen für Karten und Diagramme, bessere Sammlung von Forecast-Snapshots, explizitere Datenquellenmethodik und einen Produktions-Analytics-Loop für Empfehlungsqualität umfassen.
