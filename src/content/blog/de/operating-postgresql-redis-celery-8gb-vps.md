---
title: "PostgreSQL, Redis und Celery auf einem 8-GB-VPS betreiben"
description: "Was mich der Betrieb von PostgreSQL, Redis, Celery-Workern und mehreren SaaS-Anwendungen auf einem 8-GB-VPS über Ressourcenbudgets, Nebenläufigkeit, Queues und operative Einfachheit gelehrt hat."
date: 2026-09-05
lang: de
translationKey: operating-postgresql-redis-celery-8gb-vps
tags: ["DevOps", "PostgreSQL", "Redis", "Celery", "Docker", "Production"]
draft: false
cover: "/og/operating-postgresql-redis-celery-8gb-vps.png"
featured: false
---

Eine Machine-Learning-Anwendung in Produktion zu betreiben bedeutet normalerweise deutlich mehr, als nur ein Modell bereitzustellen.

Meine Anwendungen verwenden PostgreSQL für persistenten Zustand, Redis für Koordination, Celery für asynchrone Arbeit, FastAPI für APIs, React für Benutzeroberflächen und Docker zum Verpacken der Services. TenderWise führt außerdem geplante Beschaffungsdaten-Ingestion und optionale KI-Workloads aus. Payrithm ergänzt asynchrone Verarbeitung rund um Rechnungen, Vorhersage-Workflows und Inkassooperationen.

Die interessante Einschränkung besteht darin, dass ich diese Systeme nicht auf einem großen Kubernetes-Cluster betreibe.

Ich betreibe sie auf einem vergleichsweise kleinen VPS mit **8 GB RAM und 80 GB Speicher**.

Diese Einschränkung war nützlich. Sie zwingt mich dazu, über Ressourcenverbrauch nachzudenken, anstatt Ineffizienz hinter einer größeren Maschine zu verstecken.

Die zentrale Lektion war einfach:

> Auf einem kleinen Server ist Kapazitätsplanung Teil der Anwendungsarchitektur.

## Die Architektur

Am öffentlichen Rand verwende ich eine gemeinsame Nginx- und Certbot-Konfiguration.

Konzeptionell sieht der Server so aus:

```text
Internet
    |
    v
Nginx + TLS
    |
    +---- Portfolio
    |
    +---- Payrithm
    |       |
    |       +-- FastAPI
    |       +-- PostgreSQL
    |       +-- Redis
    |       +-- Celery
    |
    +---- TenderWise
            |
            +-- FastAPI
            +-- PostgreSQL
            +-- Redis
            +-- Celery
            +-- Celery Beat
            +-- Backup-Jobs
```

Der öffentliche Reverse Proxy weiß, wie Domains geroutet werden. Die Anwendungsdatenbanken müssen das nicht wissen.

Nur Services, die externen Traffic benötigen, treten dem öffentlichen Proxy-Netzwerk bei. PostgreSQL, Redis und Hintergrund-Worker verbleiben in privaten Docker-Netzwerken.

Damit entsteht eine nützliche Sicherheits- und Betriebsgrenze: Eine Datenbank benötigt nicht allein deshalb einen Host-Port, weil die Anwendung, die sie verwendet, öffentlich erreichbar ist.

## Acht Gigabyte sind nicht acht Gigabyte für Celery

Ein häufiger Fehler bei der Dimensionierung von Hintergrund-Workern besteht darin, auf die Maschine zu schauen und zu denken:

```text
8 GB RAM
also
reichlich Platz für Worker
```

Der Worker-Pool ist jedoch nur ein Verbraucher.

Speicher wird außerdem benötigt von:

- dem Betriebssystem,
- Docker,
- PostgreSQL,
- Redis,
- FastAPI-Prozessen,
- Frontend-Containern,
- Nginx,
- geplanten Jobs,
- Backups,
- und dem Dateisystem-Cache.

Wenn zusätzlich ein optionales lokales KI-Modell läuft, verändert sich die Rechnung noch drastischer.

Die richtige Frage lautet deshalb nicht:

> Wie viele Celery-Worker kann ich starten?

Sondern:

> Wie viel Arbeitsspeicher und CPU darf Hintergrundverarbeitung verbrauchen, ohne die interaktive Anwendung zu beeinträchtigen?

Dieser Unterschied ist wichtig.

## PostgreSQL braucht ebenfalls ein Verbindungsbudget

Celery-Nebenläufigkeit verbraucht nicht nur CPU und Arbeitsspeicher. Sie kann auch die Zahl der Datenbankverbindungen vervielfachen.

Man stelle sich einen API-Service mit eigenem SQLAlchemy-Verbindungspool und mehreren Celery-Prozessen vor, die unabhängig voneinander Datenbankverbindungen öffnen können.

Wird die Worker-Concurrency von vier auf acht erhöht, kann sich die Zahl gleichzeitiger Datenbankverbraucher potenziell verdoppeln.

Wenn mehrere Anwendungen denselben Server teilen, passiert diese Vervielfachung unabhängig in jedem Stack.

Deshalb denke ich beim Ändern der Celery-Concurrency auch über Folgendes nach:

```text
Worker-Prozesse
×
mögliche DB-Verbindungen pro Prozess
+
API-Verbindungspools
+
administrative/Hintergrund-Verbindungen
```

PostgreSQL ist extrem zuverlässig, aber eine beliebige Anzahl von Verbindungen zu öffnen ist nicht kostenlos.

Auf einer kleinen Maschine sind bewusst kleine Pools oft besser als große Standardwerte.

## Redis soll Arbeit koordinieren, nicht selbst zur Arbeit werden

Redis ist im Vergleich zu vielen anderen Services leichtgewichtig, aber man vergisst leicht, dass auch Queue-Zustand Speicher verbraucht.

Wenn Produzenten Jobs schneller einreihen können, als Worker sie verarbeiten, wird die Queue zu einem Speichersystem für unerledigte Arbeit.

Das ist normalerweise ein Signal dafür, dass an anderer Stelle etwas nicht stimmt.

Eine gesunde asynchrone Architektur benötigt irgendeine Form von Backpressure.

Ein geplanter Ingestion-Job sollte beispielsweise nicht fortlaufend Tausende doppelte Tasks erzeugen, nur weil der vorherige Zyklus noch nicht abgeschlossen ist.

Ich bevorzuge idempotente geplante Tasks und einen beobachtbaren Queue-Zustand.

In TenderWise besitzen fehlgeschlagene Beschaffungsanzeigen außerdem einen persistenten Retry-Zustand in PostgreSQL. Dadurch muss Redis nicht zum dauerhaften System of Record dafür werden, was fehlgeschlagen ist und warum.

Die Datenbank kann Felder speichern wie:

```text
Anzeige
Anzahl der Versuche
letzter Fehler
Status
nächster Retry-Zeitpunkt
```

Celery ist dafür zuständig, den Retry auszuführen.

Diese Trennung macht Recovery deutlich leichter nachvollziehbar.

## Nicht alle Hintergrundjobs sind gleich

Ein Grund, warum Celery-Kapazität schwierig wird, ist, dass Task-Laufzeiten sich radikal unterscheiden können.

TenderWise verwendet asynchrone Verarbeitung unter anderem für:

- TED-Synchronisierung,
- Retries fehlgeschlagener Anzeigen,
- Wartung abgelaufener Opportunities,
- E-Mail-Versand,
- geplante Digests,
- KI-Tender-Briefings,
- und Aufzeichnung des Worker-Zustands.

Ein E-Mail-Task und ein KI-Generierungs-Task sollten nicht als gleichwertige Workloads behandelt werden.

Ebenso kann das Herunterladen und Parsen einer großen Beschaffungsanzeige einen Worker deutlich länger belegen als das Aktualisieren eines Heartbeats.

Ein nützliches mentales Modell ist:

```text
KURZ
E-Mail
Benachrichtigungen
kleine Updates

MITTEL
Normalisierung
Scoring
geplante Bereinigung

LANG
Massen-Ingestion
Modelltraining
KI-Generierung
```

Sobald Workloads so klassifiziert sind, lässt sich Worker-Kapazität leichter entwerfen.

Wo nötig kann anschließend Queue-Trennung eingeführt werden:

```text
Redis
 |
 +-- default ------> allgemeine Worker
 |
 +-- ingestion ----> Ingestion-Worker
 |
 +-- ml/ai --------> teure Worker
```

Die genaue Topologie hängt vom Workload ab. Entscheidend ist, dass ein lang laufender Job nicht unnötig verhindert, dass ein kurzer, für den Benutzer sichtbarer Job ausgeführt wird.

## Mehr Concurrency kann das System langsamer machen

Die offensichtlichste Reaktion auf Worker-Sättigung lautet einfach:

> Mehr Worker hinzufügen.

Manchmal ist das richtig.

Mehr Concurrency kann aber auch Folgendes verursachen:

- mehr CPU-Konkurrenz,
- mehr Datenbankverbindungen,
- mehr gleichzeitige Netzwerkanfragen,
- höheren Speicherdruck,
- und mehr Kontextwechsel.

Ein Worker-Pool ist deshalb eine Entscheidung zur Ressourcenverteilung und kein Geschwindigkeitsregler.

Das Experiment, das mich interessiert, ist nicht nur:

```text
Tasks / Sekunde
```

Sondern:

```text
Hintergrund-Durchsatz
während
die API-Latenz akzeptabel bleibt
und
der Speicher stabil bleibt
```

Diese Randbedingungen müssen gemeinsam gemessen werden.

> **Messung vor der Veröffentlichung ergänzen:** Worker-Concurrency, Queue-Wartezeit, API-p95-Latenz und RAM-Nutzung für mindestens zwei Konfigurationen vergleichen.

## Queue-Alter beobachten, nicht nur CPU

CPU-Auslastung sagt mir, ob die Maschine beschäftigt ist.

Sie sagt mir nicht, ob Benutzer auf Arbeit warten.

Bei asynchronen Systemen interessieren mich:

- Queue-Tiefe,
- Alter des ältesten eingereihten Tasks,
- Task-Laufzeit,
- Task-Fehlerrate,
- Worker-Heartbeat,
- und Retry-Anzahl.

Eine Queue mit 200 Tasks kann völlig unproblematisch sein, wenn jeder Task 20 Millisekunden benötigt.

Fünf eingereihte Tasks können ein Problem sein, wenn jeder zehn Minuten benötigt.

Das Alter des ältesten noch nicht abgeschlossenen Tasks ist häufig aussagekräftiger als die reine Queue-Länge.

## Festplattenspeicher gehört zum Kapazitätsmodell

Der VPS besitzt außerdem nur eine begrenzte 80-GB-Festplatte.

Datenbanken wachsen. Docker-Images sammeln sich an. Logs wachsen. Backups wachsen. Alte Build-Layer bleiben bestehen, wenn sie nicht bereinigt werden.

Produktion benötigt deshalb unspektakuläre, aber notwendige Kontrollen:

```text
Log-Rotation
Backup-Aufbewahrung
Bereinigung von Docker-Images
Datenbank-Monitoring
Warnungen zur Festplattennutzung
```

Eine Maschine mit freiem RAM kann trotzdem spektakulär ausfallen, wenn PostgreSQL auf ein volles Dateisystem trifft.

## Was ich gelernt habe

Der Server hat verändert, wie ich über Produktionsarchitektur denke.

Ich behandle PostgreSQL, Redis und Celery nicht mehr als unabhängige Technologien.

Sie bilden ein gemeinsames Ressourcensystem.

Eine Veränderung an einer Stelle erhöht oder verschiebt den Druck an anderer Stelle.

Mehr Celery-Concurrency kann mehr PostgreSQL-Verbindungen bedeuten. Schnellere Ingestion kann größere Queues und schnelleres Datenbankwachstum bedeuten. Mehr Logging kann Debugging verbessern und gleichzeitig Festplattenspeicher verbrauchen.

Das Ziel ist deshalb nicht maximale Auslastung.

Es ist vorhersehbare Auslastung.

Für kleine Produktionssysteme ist das häufig ein besseres Engineering-Ziel, als die Architektur eines Unternehmens nachzuahmen, das Hunderte von Servern betreibt.

Ein bescheidener VPS kann überraschend leistungsfähige Anwendungen ausführen.

Aber nur, wenn jeder Service berücksichtigt, dass er die Maschine mit anderen teilt.
