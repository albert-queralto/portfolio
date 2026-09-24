---
title: "Vom Notebook in die Produktion: Einen Anomaliedetektor bereitstellen"
description: "Erfahrungen beim Überführen von Anomalieerkennung für Echtzeit-Umweltzeitreihen aus Modellexperimenten in einen interpretierbaren operativen Workflow."
date: 2026-12-08
publishAt: 2026-12-08T08:00:00+02:00
lang: de
translationKey: notebook-to-production-anomaly-detector
tags:
  [
    "Machine Learning",
    "Anomaly Detection",
    "MLOps",
    "Time Series",
    "FastAPI",
    "Explainability",
  ]
draft: false
cover: "/og/notebook-to-production-anomaly-detector.png"
featured: false
---

Einen Anomaliedetektor in einem Notebook zu bauen und ihn mit Echtzeitdaten zu betreiben sind zwei sehr unterschiedliche Engineering-Probleme.

In einem Notebook kann ich annehmen:

```text
der Datensatz existiert bereits
die Spalten sind stabil
die Zeitstempel sind sauber
Labels sind verfügbar
das Modell läuft, wenn ich es ausführe
```

In einem operativen Monitoring-System ist keine dieser Annahmen garantiert.

Diese Lücke wurde besonders deutlich, als ich mit Echtzeit-Zeitreihendaten aus Umwelt- und Wassersystemen gearbeitet habe.

Ein von mir entwickelter Detektor für Kontaminationsereignisse erreichte **mehr als 80% Erkennungsfähigkeit**, doch ein brauchbares Modell zu erhalten war nur ein Teil der Arbeit.

Die eigentliche Herausforderung bestand darin, ein System zu schaffen, dessen Ausgabe interpretierbar und handlungsrelevant ist.

## Mit der Definition eines Ereignisses beginnen

Ein häufiger Fehler bei der Anomalieerkennung ist, mit dem Algorithmus zu beginnen.

Ich beginne lieber mit dem Ereignis.

Für ein operatives Monitoring-System muss ich definieren:

```text
Was gilt als Anomalie?
Wann beginnt sie?
Wann endet sie?
Wie viel Vorwarnzeit ist nützlich?
Wie viele Fehlalarme können Operatoren tolerieren?
```

Punktgenaue Accuracy beantwortet häufig die falsche Frage.

Angenommen, ein Kontaminationsereignis dauert 30 Minuten und erzeugt 30 anomale Samples.

Ein Detektor, der 29 davon erkennt, hat einen hohen Recall auf Sample-Ebene.

Ein Detektor, der nur ein frühes Sample erkennt, kann das Ereignis operativ trotzdem erfolgreich erkannt haben.

Umgekehrt kann es wenig Wert bieten, 20 Samples erst dann zu erkennen, wenn das Ereignis ohnehin offensichtlich ist.

Die Metrik muss die reale Entscheidung widerspiegeln.

## Zeitreihenvalidierung muss zeitlich bleiben

Wie bei Rechnungsmodellen ist eine zufällige Aufteilung einzelner Zeilen gefährlich.

Benachbarte Zeitreihenbeobachtungen sind stark korreliert.

Wenn angrenzende Fenster desselben physischen Ereignisses sowohl in Trainings- als auch in Validierungsdaten auftauchen, wird die Bewertung zu optimistisch.

Ich teile lieber nach sinnvollen Zeitblöcken oder Ereignissen, sodass das Modell auf Zeiträume generalisieren muss, die es nicht gesehen hat.

Konzeptionell:

```text
vergangener Betriebszeitraum -> Training
späterer Betriebszeitraum     -> Validierung
zukünftige Ereignisse         -> Evaluation
```

Wenn Labels ereignisbasiert sind, sollten vollständige Ereignisse auf einer Seite des Splits bleiben.

## Die Datenpipeline ist Teil des Detektors

Ein bereitgestelltes Anomaliemodell erhält keinen pandas DataFrame aus einem Notebook.

Es erhält operative Daten.

Dazu können gehören:

- API-Feeds,
- FTP-Dateien,
- Sensordatenbanken,
- hydrologische Quellen,
- meteorologische Quellen,
- und geplante Datenaufnahme.

Vor der Inferenz braucht das System eine vorhersagbare Behandlung von:

- fehlenden Samples,
- doppelten Zeitstempeln,
- verspäteten Beobachtungen,
- Werten außerhalb gültiger Bereiche,
- Einheitenänderungen,
- Sensorausfällen,
- und Schemaänderungen.

Andernfalls beginnt das Modell Probleme in der Datenpipeline statt im physischen Prozess zu erkennen.

Einige dieser Probleme können weiterhin eine Warnung verdienen, sollten aber von echten Umweltbedingungen unterscheidbar sein.

## Feature Engineering muss Streaming überleben

Notebook-Features lassen sich leicht berechnen, wenn der gesamte Datensatz sichtbar ist.

Produktions-Features brauchen eine kausale Interpretation.

Für eine Vorhersage zum Zeitpunkt \(t\) muss jedes Feature aus Informationen berechenbar sein, die zu oder vor \(t\) verfügbar waren.

Zeitreihen-Features können enthalten:

- gleitende Mittelwerte,
- gleitende Variabilität,
- Änderungsraten,
- verzögerte Werte,
- Unterschiede zwischen Sensoren,
- und Abweichungen vom erwarteten Verhalten.

Die Produktionsimplementierung muss dieselben Fensterdefinitionen und dieselbe Vorverarbeitung reproduzieren wie im Training.

Schon eine Abweichung um eine Zeile in einer Rolling-Berechnung kann ein Modell erzeugen, das technisch „dasselbe“, operativ aber anders ist.

## Schwellenwerte sind Produktentscheidungen

Viele Anomaliemodelle erzeugen einen kontinuierlichen Score.

Eine Warnung benötigt einen Schwellenwert.

Dieser Schwellenwert bestimmt einen Trade-off:

```text
niedrigerer Schwellenwert
    -> höhere Sensitivität
    -> mehr Fehlalarme

höherer Schwellenwert
    -> weniger Fehlalarme
    -> mehr verpasste Ereignisse
```

Es gibt keinen universell richtigen Wert.

Operatoren kümmern sich oft ebenso um die Belastung durch Fehlalarme wie um den Machine-Learning-Recall.

Ein Detektor, der jede Anomalie findet, aber alle fünf Minuten eine Warnung sendet, wird irgendwann ignoriert.

Die Auswahl des Schwellenwerts gehört daher in Validierung und operative Überprüfung und nicht in eine beliebige Konstante nach dem Training.

## Erklärungen sind im Monitoring wichtig

Eine Anomaliewarnung ohne Kontext zwingt den Operator, seine Untersuchung bei null zu beginnen.

Ich habe SHAP verwendet, um Modellvorhersagen besser interpretierbar zu machen.

Das Ziel ist nicht, so zu tun, als würde Feature Attribution Kausalität beweisen.

Es geht darum, unterstützende Informationen bereitzustellen, etwa:

- welche Variablen am meisten beigetragen haben,
- welche Signale sich ungewöhnlich verändert haben,
- in welche Richtung sie sich bewegt haben,
- und wie sich das aktuelle Muster vom erwarteten Verhalten unterscheidet.

Dadurch kann aus:

> anomaly score = 0.91

Folgendes werden:

> Leitfähigkeit und Trübung bewegten sich außerhalb ihres normalen gemeinsamen Musters, während die übrigen überwachten Signale vergleichsweise stabil blieben.

Die zweite Ausgabe ist wesentlich handlungsrelevanter.

## Das Modell als System paketieren

Ein Produktionsmodell braucht eine wiederholbare Schnittstelle.

Das kann ein FastAPI-Service oder eine andere Anwendungsgrenze sein, die Operationen wie diese bereitstellt:

```text
Modellkonfiguration laden
Beobachtungsfenster übermitteln
Inferenz ausführen
Score zurückgeben
Erklärung zurückgeben
Modellmetadaten zurückgeben
```

Die Anwendung sollte außerdem wissen, welche Modellversion das Ergebnis erzeugt hat.

Reproduzierbarkeit erfordert mehr als das Speichern von:

```text
model.pkl
```

Nützliche Metadaten umfassen:

- Modellversion,
- Feature-Konfiguration,
- Trainingszeitraum,
- Schwellenwert,
- Eingabeschema,
- Scaler oder Preprocessor,
- und Evaluationsmetriken.

Die Vorhersage ist nur reproduzierbar, wenn Vorverarbeitung und Konfiguration ebenfalls reproduzierbar sind.

## Konfiguration wird zu einem Produktproblem

Sobald mehrere Modelle existieren, skaliert manuelles Bearbeiten von Konfigurationsdateien nicht mehr.

Ich habe Streamlit- und FastAPI-Werkzeuge für Modellkonfiguration, Migration und Visualisierung gebaut.

Diese Schicht ist wichtig, weil operatives Machine Learning normalerweise mehr als einen Forscher umfasst.

Irgendwann muss jemand folgende Fragen beantworten:

```text
Welches Modell ist aktiv?
Welche Sensoren verwendet es?
Welcher Schwellenwert ist konfiguriert?
Wann wurde es trainiert?
Wie gut funktioniert es?
```

Eine Model Registry muss nicht als riesige MLOps-Plattform beginnen.

Sie muss den Zustand explizit machen.

## Monitoring sollte auch die Eingaben umfassen

Die Modellgenauigkeit kann sich verschlechtern, während die API vollkommen gesund bleibt.

Produktionsmonitoring braucht deshalb zwei Ebenen.

### Systemzustand

```text
Service verfügbar
Inferenzlatenz
Daten kommen an
geplante Jobs gesund
Datenbank erreichbar
```

### Modellzustand

```text
Eingabeverteilung
Fehlwerte
Score-Verteilung
Warnfrequenz
Erkennung beobachteter Ereignisse
Fehlalarme
Feature-Drift
```

Eine `200 OK`-Antwort sagt mir nur, dass die Software ausgeführt wurde.

Sie sagt mir nicht, dass die Vorhersage weiterhin nützlich ist.

## Feedback schließt den Kreislauf

Umweltanomalien sind besonders schwierig, weil Labels verspätet eintreffen können und Expertenprüfung wichtig ist.

Ein operativer Workflow sollte Folgendes aufbewahren:

```text
Vorhersage-Zeitstempel
Anomaliescore
Schwellenwertentscheidung
Modellversion
Bewertung des Operators
bestätigtes Ereignisergebnis
```

Damit entsteht die Evidenz, die nötig ist, um den Detektor später zu bewerten.

Ohne diese Verbindung wird bereitgestelltes Machine Learning zu einem Strom von Vorhersagen ohne langfristigen Lernmechanismus.

## Was sich gegenüber dem Notebook geändert hat

Das Modell selbst blieb wichtig.

Seine relative Bedeutung wurde jedoch kleiner.

Das Produktionssystem benötigte zusätzlich:

```text
zuverlässige Datenaufnahme
zeitliche Validierung
kausale Feature-Berechnung
Schwellenwertmanagement
Versionierung
Interpretierbarkeit
APIs
Konfigurationswerkzeuge
Monitoring
Feedback
```

Diese Bausteine bestimmen, ob der Detektor dem Kontakt mit echten operativen Daten standhält.

Das ist die wichtigste Lehre, die ich aus angewandter Anomalieerkennung mitgenommen habe.

Ein Notebook zeigt, dass ein Modell ein Muster finden kann.

Ein Produktionssystem muss zeigen, dass dieses Muster zu einer zuverlässigen Entscheidung werden kann.
