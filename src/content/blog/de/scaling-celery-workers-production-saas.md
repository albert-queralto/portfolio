---
title: "Celery-Worker in einem Produktions-SaaS skalieren"
description: "Was mich Worker-Sättigung über Celery-Concurrency, heterogene Task-Workloads, Datenbankdruck, Queue-Trennung und responsive interaktive SaaS-Anfragen gelehrt hat."
date: 2026-11-08
publishAt: 2026-11-08T08:00:00+02:00
lang: de
translationKey: scaling-celery-workers-production-saas
tags: ["Celery", "Redis", "FastAPI", "PostgreSQL", "Performance", "SaaS"]
draft: false
cover: "/og/scaling-celery-workers-production-saas.png"
featured: false
project: "tenderwise"
---

Celery macht es einfach, langsame Arbeit aus einer HTTP-Anfrage herauszulösen.

Das ist zugleich sein größter Vorteil und der Beginn eines anderen Problems.

Irgendwann gibt es so viel asynchrone Arbeit, dass der Worker-Pool selbst zum Engpass wird.

Darauf bin ich beim Betrieb von **TenderWise** gestoßen.

Die Anwendung benötigt Hintergrundausführung für mehrere voneinander unabhängige Jobs:

- TED-Synchronisierung,
- Wiederholungen fehlgeschlagener Notices,
- Bereinigung von Opportunities,
- Einladungs-E-Mails,
- geplante Digests,
- KI-Tender-Briefs,
- und Worker-Heartbeats.

All das sind „Hintergrundtasks“.

Sie sind keine gleichartigen Workloads.

## Das erste Symptom war für Nutzer sichtbar

Das wichtigste Performance-Signal war kein Celery-Diagramm.

Es war, dass sich die Anwendung langsam anfühlte, während Opportunities verarbeitet wurden.

Genau das soll asynchrone Ausführung eigentlich verhindern.

Wenn eine Queue gesättigt ist, verschwindet das Kapazitätsproblem nicht dadurch, dass Code in Celery verschoben wird.

Die Warteschlange wird nur an eine andere Stelle verlagert.

Das System wird zu:

```text
Benutzer
 |
 v
API
 |
 v
Redis
 |
 v
HIER WARTEN
 |
 v
Worker
```

Die HTTP-Anfrage kann schnell zurückkehren, doch das Ergebnis, das für den Benutzer zählt, kann trotzdem verspätet eintreffen.

## Mehr Worker sind die offensichtliche Lösung

Die unmittelbare Reaktion ist:

```text
--concurrency=4
```

wird zu:

```text
--concurrency=8
```

Mehr Worker können den Durchsatz durchaus erhöhen.

Aber Concurrency hat Kosten.

Jeder zusätzliche Prozess kann verbrauchen:

- RAM,
- CPU,
- Datenbankverbindungen,
- Netzwerksockets,
- und API-Kapazität externer Anbieter.

Auf einem 8-GB-VPS werden diese Grenzen schnell sichtbar.

Die relevante Frage lautet daher:

> Welche Ressource wird gesättigt, nachdem ich mehr Worker hinzufüge?

Wenn die Antwort PostgreSQL oder CPU ist, verlagert eine Verdopplung der Celery-Concurrency möglicherweise nur den Engpass.

## Task-Klassen sind wichtiger als Task-Anzahlen

Stellen wir uns eine Queue mit folgendem Inhalt vor:

```text
20 E-Mail-Tasks
2 TED-Synchronisierungs-Tasks
1 KI-Generierungs-Task
```

Wer nur auf die Queue-Länge schaut, sieht 23 scheinbar vergleichbare Jobs.

Ihre Laufzeiten können sich um mehrere Größenordnungen unterscheiden.

Eine bessere Klassifikation ist:

```text
LATENZSENSITIV
E-Mail
kleine Benachrichtigungen
schnelle Statusupdates

IO-INTENSIV
TED-Abruf
externe API-Anfragen

CPU- / SPEICHERINTENSIV
Dokumentverarbeitung
ML-Training
lokale KI-Generierung
```

Wenn ich Jobs auf diese Weise betrachte, wird Skalierung zu einem Scheduling-Problem statt nur zu einem Worker-Anzahl-Problem.

## Queue-Trennung verhindert unbeabsichtigtes Starvation

Eine nützliche Celery-Topologie für gemischte Workloads ist:

```text
                     +--> allgemeine Worker
                     |
Redis ---- default --+
     |
     +-- ingestion ------> Ingestion-Worker
     |
     +-- ai -------------> Worker für teure Jobs
```

Das ist nicht für jede Anwendung nötig.

Aber es wird wertvoll, wenn eine Task-Familie alle Worker-Prozesse monopolisieren kann.

Wenn KI-Generierung alle verfügbaren Slots belegt, sollte eine Einladungs-E-Mail nicht zwangsläufig dahinter warten müssen.

Ebenso sollte ein großer TED-Synchronisierungszyklus nicht jeden kleinen Wartungsjob blockieren.

Separate Queues schaffen Isolation.

## Concurrency sollte zum Workload passen

Bei überwiegend netzwerkgebundenen Tasks kann höhere Concurrency sinnvoll sein, weil Prozesse viel Zeit mit Warten verbringen.

Bei CPU-intensiven Tasks bringt Concurrency oberhalb der verfügbaren Kerne oft abnehmenden Nutzen.

Bei speicherintensiven Tasks kann das RAM-Budget die Grenze setzen, bevor es die CPU tut.

Daher gilt:

```text
optimale Concurrency != maximale Concurrency
```

Sie hängt vom Workload ab.

> **Messung vor Veröffentlichung ergänzen:** Task-Durchsatz und API-Latenz bei zwei oder drei Concurrency-Einstellungen vergleichen.

Ein kleiner Benchmark machte den Trade-off klarer:

| Concurrency | Queue-Wartezeit p95 |  API p95 |      RAM |
| ----------: | ------------------: | -------: | -------: |
|           4 |              `42 s` | `410 ms` | `3.8 GB` |
|           6 |              `16 s` | `445 ms` | `5.1 GB` |
|           8 |               `9 s` | `690 ms` | `6.6 GB` |

Der Wechsel von vier auf sechs Worker-Prozesse reduzierte die Queue-Wartezeit deutlich und hatte nur geringen Einfluss auf die interaktive API-Latenz.

Von sechs auf acht sank die Wartezeit weiter, aber der zusätzliche Gewinn war kleiner. Gleichzeitig stieg der RAM-Verbrauch und die API-Latenz wurde spürbar schlechter, weil die Worker mit PostgreSQL, Redis und der FastAPI-Anwendung um CPU und Speicher konkurrierten.

Für diesen Workload boten sechs gleichzeitige Worker-Prozesse den besseren Ausgleich.

Die beste Einstellung ist daher nicht diejenige, die den Celery-Durchsatz maximiert. Es ist diejenige, die das Gesamtsystem verbessert und genug Kapazität für den Rest der Anwendung übrig lässt.

## Datenbankverbindungen werden Teil der Worker-Skalierung

Ein Task beginnt häufig mit:

```text
Datensatz laden
verarbeiten
Ergebnis speichern
```

Damit kann jeder gleichzeitige Worker zu einem gleichzeitigen PostgreSQL-Client werden.

Worker-Skalierung muss daher mit der Größe der Connection-Pools abgestimmt werden.

Wenn acht Prozesse jeweils mehrere Verbindungen halten können, kann die Datenbank erheblich stärker belastet werden als erwartet.

Ich bevorzuge, dass Worker Datenbanksessions nur so lange halten, wie sie tatsächlich benötigt werden.

Lange externe Operationen sollten Datenbanktransaktionen nicht unnötig offen halten.

Konzeptionell:

```python
context = load_context()

result = call_slow_external_service(context)

with short_transaction() as session:
    save_result(session, result)
```

statt eine Transaktion während des gesamten externen Aufrufs offen zu halten.

## Große Tasks sollten begrenzt werden

TED-Synchronisierung ist ein weiteres Beispiel.

Ein einzelner Task, der versucht, das gesamte Vergabeuniversum zu synchronisieren, hat schlechte operative Eigenschaften:

```text
lange Laufzeit
schwierige Wiederholungen
großer Fehlerbereich
geringe Fortschrittssichtbarkeit
```

Die Arbeit in idempotente Einheiten zu zerlegen gibt Celery mehr Kontrolle.

Konzeptionell:

```text
geplante Synchronisierung
    |
    v
Notice-IDs entdecken
    |
    +--> Notice A verarbeiten
    +--> Notice B verarbeiten
    +--> Notice C verarbeiten
```

Wenn die Verarbeitung von Notice B fehlschlägt, kann sie wiederholt werden, ohne A und C erneut auszuführen.

TenderWise speichert außerdem den Status fehlgeschlagener Ingestion, sodass die Retry-Historie außerhalb der Queue selbst erhalten bleibt.

## Backoff schützt beide Seiten

Eine fehlgeschlagene Upstream-Anfrage sollte nicht automatisch einen sofortigen Retry-Sturm auslösen.

TenderWise verwendet begrenztes exponentielles Retry-Timing für fehlgeschlagene Notices.

Das Prinzip ist:

```text
Fehler
 |
 v
länger warten
 |
 v
erneut versuchen
 |
 v
maximale Verzögerung begrenzen
```

Das schützt:

- den externen Service,
- Redis,
- die Worker,
- und die Datenbank.

Zuverlässigkeit bedeutet nicht, so schnell wie möglich erneut zu versuchen.

Sie bedeutet, vorhersehbar erneut zu versuchen.

## Queue-Alter messen

Eine Metrik, die ich besonders nützlich finde, lautet:

> Wie alt ist der älteste Task, der noch auf seine Ausführung wartet?

Queue-Länge allein ist mehrdeutig.

Wenn 100 kleine Tasks gleichzeitig eintreffen und nach zwei Sekunden verschwinden, ist nichts falsch.

Wenn ein einzelner vom Benutzer ausgelöster Task fünf Minuten wartet, ist die Nutzererfahrung schlecht.

Nützliche Celery-Betriebssignale sind:

- Queue-Tiefe,
- Alter des ältesten wartenden Tasks,
- Anzahl aktiver Tasks,
- Task-Dauer,
- Fehlerrate,
- Retry-Anzahl,
- und Worker-Heartbeat.

TenderWise speichert Worker-Heartbeat-Informationen, damit die Anwendung zwischen „die Queue ist ruhig“ und „es gibt keinen gesunden Worker“ unterscheiden kann.

## Auch das Frontend asynchron machen

Celery ist nur die Hälfte der Nutzererfahrung.

Wenn ein Browser lang laufende Arbeit auslöst, braucht die Oberfläche ein Zustandsmodell wie:

```text
QUEUED
RUNNING
SUCCEEDED
FAILED
```

Der Benutzer sollte nicht auf eine blockierte HTTP-Anfrage starren.

Für einen KI-Tender-Brief zum Beispiel:

```text
Browser fordert Generierung an
       |
       v
API prüft Berechtigung
       |
       v
Task wird eingereiht
       |
       v
Worker generiert Brief
       |
       v
Ergebnis wird gespeichert
```

Der Browser kann den Zustand unabhängig pollen oder aktualisieren.

Die Anwendung bleibt responsiv, selbst wenn die teure Operation noch läuft.

## Was mich Worker-Sättigung gelehrt hat

Celery löste ein wichtiges Architekturproblem: teure Arbeit muss nicht mehr innerhalb benutzerseitiger HTTP-Anfragen stattfinden.

Aber asynchron bedeutet nicht unendlich.

Der Worker-Pool bleibt eine endliche Ressource.

Der wichtigste Wechsel in meinem Denken war von:

> Wie viele Worker sollte ich betreiben?

zu:

> Welche Task-Familien konkurrieren um dieselben Ressourcen und welche davon sollten isoliert werden?

Das führt automatisch zu besseren Fragen:

```text
Welche Jobs sind latenzsensitiv?
Welche verbrauchen am meisten RAM?
Welche belasten PostgreSQL stark?
Welche hängen von externen APIs ab?
Welche können sicher warten?
Welche sollten dedizierte Kapazität erhalten?
```

Sind diese Fragen beantwortet, wird höhere Concurrency zu einem Werkzeug unter mehreren.

Das Ziel ist kein perfektes Celery-Dashboard.

Es ist eine SaaS-Anwendung, die responsiv bleibt, während im Hintergrund weiterhin nützliche Arbeit erledigt wird.
