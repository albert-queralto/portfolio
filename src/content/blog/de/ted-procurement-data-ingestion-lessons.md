---
title: "Was bei der Ingestion von TED-Vergabedaten schiefging"
description: "Die Datenmodell- und Zuverlässigkeitsprobleme, die TenderWises TED-Ingestion-Pipeline geprägt haben – von Notice-Versionen und Losen bis zu mehrsprachigen Feldern, Retries und teilstrukturierten Qualifikationskriterien."
date: 2026-10-01
publishAt: 2026-10-01T08:00:00+02:00
lang: de
translationKey: ted-procurement-data-ingestion-lessons
tags: ["Data Engineering", "ETL", "PostgreSQL", "Celery", "Procurement", "SaaS"]
draft: false
cover: "/og/ted-procurement-data-ingestion-lessons.png"
featured: false
project: "tenderwise"
---

Als ich mit dem Aufbau von **TenderWise** begann, wirkte die Ingestion europäischer Vergabebekanntmachungen wie der einfache Teil.

TED durchsuchen, eine Notice abrufen, einige Felder parsen und in PostgreSQL speichern.

Danach die Opportunity bewerten.

Je mehr ich mit den Quelldaten arbeitete, desto deutlicher wurde, dass die Ingestion-Schicht kein bloßes Plumbing-Detail war.

Sie war Teil des Entscheidungsmodells des Produkts.

Wenn die Quelle falsch interpretiert wird, kann alles Nachgelagerte mit großer Überzeugung falsch sein.

Diese Fehlerbilder haben die Architektur verändert.

## Problem 1: Ein Suchergebnis ist nicht die Quelle der Wahrheit

TenderWise verwendet die TED Search API, um Notices zu entdecken.

Für die vollständige Bewertung reichen Discovery-Daten jedoch nicht aus.

Deshalb behandle ich das kanonische TED-XML als autoritative Quelle für Opportunity-Details.

Die Pipeline wurde zu:

```text
TED Search API
    |
Publikationsnummer
    |
    v
kanonisches XML
    |
    v
Checksum
    |
    v
Quellversion
    |
    v
Normalisierung
    |
    v
Opportunity
```

Die Unterscheidung ist wichtig, weil TenderWise mehr als Titel und Deadline benötigt.

Es braucht Quellbelege für Dinge wie:

- CPV-Codes,
- Länder,
- Vertragswert,
- Lose,
- Auswahlkriterien,
- und Qualifikationsanforderungen.

## Problem 2: Notices ändern sich

Eine Vergabebekanntmachung ist nicht zwangsläufig unveränderlich.

Korrekturen und spätere Versionen können relevante Details verändern.

Die vorherige Datenbankzeile einfach zu überschreiben würde die Historie zerstören, die erklärt, warum sich eine Empfehlung geändert hat.

TenderWise berechnet deshalb einen SHA-256-Checksum des kanonischen Quellinhalts.

Konzeptionell:

```python
checksum = sha256(xml_payload.encode("utf-8")).hexdigest()
```

Existiert der Checksum für die Publikationsnummer bereits, kann der Ingestion-Pfad unnötige Neuverarbeitung vermeiden.

Unterscheidet er sich, kann die Anwendung eine neue Quellversion speichern.

Damit erhält das System Provenienz:

```text
Empfehlung
    |
basiert auf
    |
Opportunity-Zustand
    |
abgeleitet aus
    |
bestimmter Version der Quell-Notice
```

Das wird besonders wichtig, wenn ein Benutzer fragt, warum die Bewertung von gestern anders ist als die heutige.

## Problem 3: Eine Notice kann mehrere Opportunities enthalten

Mein erstes mentales Modell war zu stark auf die Notice ausgerichtet.

Eine TED-Notice kann mehrere Lose beschreiben.

Diese Lose können sich in Umfang, Wert, Geografie oder Anforderungen unterscheiden.

Die gesamte Notice als eine einzige Opportunity zu behandeln kann daher Fakten zusammenführen, die getrennt bleiben sollten.

TenderWises internes Modell wurde losorientiert.

Ein normalisiertes Los enthält Felder wie:

```text
Los-ID
Titel
Beschreibung
Auftraggeber
Länder
CPV-Codes
geschätzter Wert
Währung
Deadline
Quellsprache
Anforderungen
```

Die Ingestion-Einheit ist nicht mehr:

> Ich habe eine Notice heruntergeladen.

Sondern:

> Ich habe aus einer versionierten Notice eine oder mehrere normalisierte kommerzielle Opportunities erzeugt.

## Problem 4: Geografie ist nicht ein sauberer Code

UI und Unternehmensprofile sollten nicht jede Darstellung verstehen müssen, die ein Upstream-Datensatz verwendet.

Nachgelagerte Logik sollte sich nicht darum kümmern, ob eine Quelle eine andere Ländercode-Darstellung nutzt als die Anwendung erwartet.

Diese Konvertierung gehört in die Normalisierung.

Das klingt trivial, doch Normalisierungsfehler sind besonders gefährlich, weil sie stille Nichtübereinstimmungen erzeugen.

Ein Unternehmen kann Spanien als Zielland konfigurieren und trotzdem spanische Opportunities verpassen, wenn beide Schichten unterschiedliche Länderdarstellungen verwenden.

Dieselbe allgemeine Regel gilt über Geografie hinaus:

> Externe Variabilität sollte an der Ingestion-Grenze enden.

## Problem 5: CPV-Codes sind hierarchisch

Auch CPV-Matching ist subtiler als Gleichheit.

Ein Unternehmen, das an einer breiteren Dienstleistungsfamilie interessiert ist, sollte eine Notice nicht zwangsläufig verpassen, nur weil diese einen spezifischeren untergeordneten Code verwendet.

TenderWise normalisiert daher CPV-Werte und erlaubt sinnvolles Family-Prefix-Matching.

Praktisch bedeutet das, dass eine breiter konfigurierte Familie mit einer spezifischeren Notice-Klassifikation innerhalb dieser Familie übereinstimmen kann.

Exaktes String-Matching würde False Negatives erzeugen.

Naiv jedes Präfix zu matchen würde dagegen zu viele False Positives produzieren.

Domänenhierarchie gehört in die Matching-Logik.

## Problem 6: Mehrsprachiger Text braucht deterministische Fallback-Regeln

TED ist mehrsprachig.

Ein Feld, das ich in einer bestimmten Sprache möchte, kann fehlen, während eine andere lokalisierte Darstellung vorhanden ist.

Normalisierung braucht deshalb eine explizite Präferenz- und Fallback-Strategie.

Der wichtige Teil ist nicht, während der Ingestion eine magische Übersetzung zu versuchen.

Wichtig ist, dass die Scoring-Schicht ein vorhersehbares Feld erhält.

Ich möchte, dass nachgelagerter Code Folgendes konsumiert:

```python
opportunity.title
```

statt alle möglichen XML-Pfade und Sprachalternativen verstehen zu müssen, aus denen es entstanden ist.

## Problem 7: Qualifikationskriterien sind nur teilweise strukturiert

Einige der kommerziell wichtigsten Tender-Informationen stehen in natürlichsprachlichen Auswahlkriterien.

Beispiele sind:

- Mindestjahresumsatz,
- Mindestteamgröße,
- ISO-Zertifizierung,
- und Anzahl vergleichbarer Verträge.

Einige davon lassen sich sicher in strukturierte Anforderungen überführen.

Andere nicht.

Gefährlich wäre, jeden Satz in einen strukturierten Wert zu zwingen.

TenderWise behält stattdessen die Originalbeschreibung und den Quellpfad und erzeugt bei ausreichender Sicherheit zusätzlich eine strukturierte Anforderung.

Wenn eine Regel nicht zuverlässig extrahiert werden kann, wird sie zu Evidenz für manuelle Prüfung.

Das ist bewusst weniger ambitioniert, als vorzugeben, der Parser verstehe alles.

## Problem 8: Unbekannt ist nicht null

Fehlende Informationen schaffen ein weiteres subtiles Ingestion-Problem.

Angenommen, der Vertragswert fehlt.

Das bedeutet nicht:

```text
Vertragswert = 0
```

Ebenso bedeutet ein nicht parsebares Qualifikationskriterium nicht, dass das Unternehmen es nicht erfüllt.

TenderWise erhält unbekannte Zustände und Warnungen.

Das ist nachgelagert wichtig, weil:

```text
FAIL
```

und:

```text
UNKNOWN
```

zu sehr unterschiedlichen Vergabeentscheidungen führen.

## Problem 9: Transiente Fehler dürfen Tender nicht verschwinden lassen

Netzwerkanfragen schlagen fehl. Externe XML-Endpunkte schlagen fehl. Unerwartete Dokumente tauchen auf. Parsing-Bugs passieren.

Ein Produktions-Ingestion-System darf solche Datensätze nicht still überspringen.

TenderWise speichert fehlgeschlagenen Ingestion-Zustand mit Informationen wie:

```text
Anzahl der Versuche
Fehler
Status
Zeitpunkt des nächsten Retries
```

Retries verwenden begrenzten exponentiellen Backoff, statt ein bereits fehlerhaftes Upstream-System weiter zu belasten.

Konzeptionell:

```text
Versuch 1 -> 1 Stunde
Versuch 2 -> 2 Stunden
Versuch 3 -> 4 Stunden
...
begrenzt auf ein maximales Intervall
```

Damit erhalten Fehler einen sichtbaren Lebenszyklus.

Ein defekter Download wird zu einem operativen Objekt, das inspiziert und erneut versucht werden kann, statt zu einem verschwundenen Tender, von dessen Existenz niemand weiß.

## Problem 10: Idempotenz ist wichtig

Geplante Synchronisierung wird dasselbe Vergabeuniversum wiederholt besuchen.

Die Pipeline muss Wiederholung deshalb tolerieren.

Ingestion zweimal auszuführen sollte nicht zwei Kopien desselben Loses erzeugen.

Identisches XML erneut zu verarbeiten sollte keine künstlichen Versionen erzeugen.

Ein Retry nach einem Worker-Crash sollte keine widersprüchlichen Datensätze hinterlassen.

Checksums, stabile Quell-IDs und Datenbank-Upserts sind daher keine Optimierungsdetails.

Sie sind Korrektheitsmechanismen.

## Was sich in meinem Denken geändert hat

Anfangs dachte ich, der interessante Teil von TenderWise würde nach der Ingestion beginnen:

```text
matching
scoring
BID / REVIEW / NO_BID
```

In Wirklichkeit hängt die Qualität dieser Entscheidungen stark davon ab, was davor passiert.

Das Ingestion-System bestimmt:

- was eine Opportunity ist,
- welche Quellversion sie repräsentiert,
- welche Daten bekannt sind,
- welche Daten unbekannt sind,
- und ob ein Fehler wiederherstellbar bleibt.

Die endgültige Architektur ist deshalb deutlich expliziter:

```text
TED Search
    -> kanonische Quelle abrufen
    -> Versionserkennung
    -> Losnormalisierung
    -> Anforderungsextraktion
    -> persistente Opportunity
    -> Discovery-Matching
    -> Relevanz
    -> Qualifikation
```

Diese Architektur ist unbequemer, als eine Suchantwort direkt in einer Datenbank zu speichern.

Sie ist zugleich wesentlich vertrauenswürdiger.

Die wichtigste Lehre aus der TED-Ingestion ist für mich, dass externe Daten ihre Inkonsistenzen nicht durch die gesamte Anwendung hindurchtragen dürfen.

Normalisierung ist der Ort, an dem Unsicherheit explizit wird.

Und in einem Entscheidungsunterstützungssystem ist explizite Unsicherheit deutlich sicherer als falsche Präzision.
