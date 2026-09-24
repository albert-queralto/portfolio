---
title: "Wie ich mehrere ML-Anwendungen auf einem kleinen Server betreibe"
description: "Wie ich Docker, private Anwendungsnetzwerke und einen gemeinsamen Nginx-Edge nutze, um mehrere ML- und SaaS-Projekte auf einem 8-GB-VPS zu betreiben, ohne daraus einen Mini-Kubernetes-Cluster zu machen."
date: 2026-12-22
publishAt: 2026-12-22T08:00:00+02:00
lang: de
translationKey: running-several-ml-applications-small-server
tags:
  ["DevOps", "Docker", "Nginx", "Machine Learning", "SaaS", "Infrastructure"]
draft: false
cover: "/og/running-several-ml-applications-small-server.png"
featured: false
---

Mein Portfolio sieht wie eine Sammlung unabhängiger Anwendungen aus.

Operativ teilen mehrere davon dieselbe physische Einschränkung:

denselben Server.

Die Maschine verfügt über **8 GB RAM und 80 GB Speicherplatz**.

Sie muss eine Portfolio-Website ausliefern und gleichzeitig Anwendungen wie Payrithm und TenderWise unterstützen, einschließlich APIs, PostgreSQL-Datenbanken, Redis-Queues, Celery-Workern und geplanten Jobs.

Ich könnte das lösen, indem jedes Projekt eine eigene Cloud-Umgebung erhält.

Für meine aktuelle Größenordnung würde das Kosten und operative Komplexität schneller erhöhen als den Nutzen.

Stattdessen nutze ich bewusst eine einfache Architektur.

## Ein gemeinsamer öffentlicher Edge

Der Server stellt einen gemeinsamen Nginx-Reverse-Proxy bereit.

Konzeptionell:

```text
Internet
    |
    v
Nginx + Certbot
    |
    +-- albertqueralto.dev
    |
    +-- payrithm.albertqueralto.dev
    |
    +-- tenderwise.albertqueralto.dev
```

Nginx übernimmt:

- TLS,
- Host-Routing,
- Proxy-Header,
- HTTP-Konfiguration,
- und öffentliche Einstiegspunkte.

Die Anwendungen müssen öffentliches TLS nicht jeweils selbst lösen.

Außerdem habe ich damit einen offensichtlichen Ort, um eingehenden Traffic und Zertifikatskonfiguration zu prüfen.

## Jede Anwendung bleibt ihr eigener Stack

Einen Server zu teilen bedeutet nicht, alles in einer riesigen Docker-Compose-Datei zu betreiben.

Ich bevorzuge, dass jede Anwendung ihre eigenen Services besitzt.

Zum Beispiel:

```text
TenderWise
    |
    +-- web
    +-- API
    +-- PostgreSQL
    +-- Redis
    +-- Celery
    +-- Celery Beat
    +-- backup service
```

während Payrithm mit seinem eigenen Stack unabhängig weiterentwickelt werden kann.

Damit bleibt eine wichtige Eigenschaft erhalten:

> Ich kann eine Anwendung deployen, ohne konzeptionell den Server zu deployen.

Der gemeinsame Edge ist Infrastruktur.

Das Compose-Projekt der Anwendung ist das Produkt.

## Nur der öffentliche Service tritt dem Proxy-Netzwerk bei

Bei TenderWise muss nur der webseitige Container mit dem öffentlichen Nginx-Edge kommunizieren.

Intern:

```text
öffentliches Proxy-Netzwerk
        |
        v
TenderWise web
        |
        v
privates TenderWise-Netzwerk
        |
        +-- API
        +-- PostgreSQL
        +-- Redis
        +-- Celery
        +-- scheduler
        +-- backups
```

PostgreSQL muss keinen öffentlichen Host-Port binden.

Redis ebenfalls nicht.

Die Worker auch nicht.

Dasselbe Muster gilt für andere Anwendungen.

Dadurch sinkt die Zahl der vom Host exponierten Services drastisch.

## Container sind Isolation, keine Magie

Docker erleichtert die Trennung von Anwendungsabhängigkeiten.

Es erzeugt keinen zusätzlichen RAM.

Alle Container teilen weiterhin dieselbe zugrunde liegende Maschine.

Deshalb muss ich global über Folgendes nachdenken:

```text
CPU
Arbeitsspeicher
Speicherplatz
Netzwerk
```

auch wenn Deployments pro Projekt getrennt sind.

Besonders sichtbar wird das bei Hintergrundworkern.

Payrithm und TenderWise können einzeln perfekt konfiguriert sein und trotzdem um dieselbe physische CPU konkurrieren.

Kapazitätsplanung existiert deshalb auf zwei Ebenen:

```text
innerhalb jeder Anwendung
und
über den gesamten Host hinweg
```

## Stateful Services brauchen besondere Behandlung

Zustandslose Frontend- und API-Container lassen sich relativ leicht neu erstellen.

PostgreSQL ist anders.

Anwendungscontainer dürfen verschwinden.

Datenbank-Volumes dürfen nicht ebenso beiläufig verschwinden.

Deshalb behandle ich:

- Datenbank-Volumes,
- Backup-Dateien,
- und hochgeladene oder persistente Daten

als Infrastruktur mit einem expliziten Lebenszyklus.

Backups verursachen auf einem kleinen Server ein weiteres Problem: Speicherverbrauch.

Wenn ich jedes Backup für immer aufbewahre, wird aus einer funktionierenden Backup-Strategie irgendwann eine Strategie zur Speichererschöpfung.

Retention ist wichtig.

## Docker-Images verbrauchen ebenfalls die 80 GB Speicherplatz

Häufige Deployments hinterlassen Layer.

Mit der Zeit kann der Host enthalten:

```text
alte Images
ungenutzten Build-Cache
gestoppte Container
Anwendungslogs
Datenbank-Backups
Datenbankwachstum
```

Speicher-Monitoring ist deshalb genauso wichtig wie CPU-Monitoring.

Ein Service kann noch freien RAM haben und trotzdem ausfallen, weil PostgreSQL auf einem vollen Datenträger keine Datei mehr vergrößern kann.

Wartung braucht unspektakuläre Aufgaben wie:

```text
Logs rotieren
alte Backups ablaufen lassen
ungenutzte Docker-Images entfernen
Volume-Wachstum überwachen
```

Diese Aufgaben sind nicht glamourös.

Sie sind Production Engineering.

## Ich bevorzuge explizite private Netzwerke

Mehrere Compose-Projekte schaffen Möglichkeiten für versehentliche Kopplung.

Ein Service in Payrithm sollte nicht die TenderWise-Datenbank adressieren können, nur weil beide zufällig Docker-Container sind.

Private Netzwerke pro Anwendung liefern eine nützliche Standardgrenze.

Die Architektur wird zu:

```text
                 gemeinsames Proxy-Netzwerk
                 /                      \
                /                        \
        Payrithm web               TenderWise web
             |                           |
      privates Netzwerk            privates Netzwerk
             |                           |
      interne Services             interne Services
```

Gemeinsame Infrastruktur ist explizit.

Alles andere ist standardmäßig isoliert.

## Hintergrundverarbeitung ist die schwierigste gemeinsame Ressource

Statische Seiten sind günstig.

HTTP-Anfragen sind meist kurz.

Hintergrund-Workloads können Ressourcen deutlich länger belegen.

Beispiele sind:

- Synchronisierung von Vergabedaten,
- Dokumentverarbeitung,
- ML-Training,
- KI-Generierung,
- und geplante Analysen.

Deshalb achte ich bei Workern besonders sorgfältig auf Ressourcenbudgets.

Wenn mehrere Anwendungen gleichzeitig teure Hintergrundarbeit ausführen, ändert keine Docker-Isolation die Tatsache, dass sie dieselbe CPU und denselben RAM teilen.

Deshalb interessieren mich:

- Celery-Concurrency,
- Queue-Tiefe,
- Task-Planung,
- Worker-Gesundheit,
- und Datenbank-Connection-Pools

auf Host-Ebene.

## Scheduling kann Ressourcenkonkurrenz reduzieren

Nicht jeder Job muss sofort laufen.

Geplante Wartung, Backups und Ingestion können teilweise auf unterschiedliche Zeitfenster verteilt werden.

Zum Beispiel müssen nicht jedes Datenbank-Backup und jeder Ingestion-Scheduler exakt in derselben Minute starten.

Wiederkehrende Workloads zeitlich zu versetzen ist eine einfache Form des Kapazitätsmanagements.

In einem großen Cluster wäre das vielleicht kaum relevant.

Auf einem 8-GB-Host ist es das.

## Observability muss nicht mit einer riesigen Plattform beginnen

Mein aktuelles Ziel ist nicht, den Observability-Stack eines Hyperscalers nachzubauen.

Ich brauche genug Sichtbarkeit, um praktische Fragen zu beantworten:

```text
Geht dem Server der Speicher aus?
Füllt sich der Datenträger?
Ist PostgreSQL gesund?
Ist Redis erreichbar?
Leben die Celery-Worker?
Wächst eine Queue?
Werden HTTP-Anfragen langsamer?
Ist ein geplanter Job fehlgeschlagen?
```

Health-Endpunkte auf Anwendungsebene, Worker-Heartbeats, Docker-Logs und Host-Metriken können viele dieser Fragen beantworten.

Der Observability-Stack sollte proportional zum System sein.

## Wann sollte der Server größer werden?

Mehrere Anwendungen auf einem Host zu betreiben ist keine dauerhafte architektonische Ideologie.

Es ist eine Kosten-/Komplexitätsentscheidung.

Ich würde Workloads trennen, wenn Signale wie diese dauerhaft werden:

```text
Speicherdruck trotz Optimierung
CPU-Konkurrenz beeinträchtigt interaktiven Traffic
Datenbanklast benötigt unabhängige Skalierung
KI-Workloads dominieren die Host-Kapazität
unterschiedliche Verfügbarkeitsanforderungen
starkes Kunden- oder Datenwachstum
Wartung einer Anwendung beeinträchtigt eine andere
```

Dann kann sich die Architektur weiterentwickeln.

Zum Beispiel:

```text
gemeinsamer Server
      |
      +--> dedizierte Datenbank
      |
      +--> dedizierte Worker-Maschine
      |
      +--> getrennte Anwendungshosts
```

Die bestehenden Docker-Grenzen erleichtern diese Migration, weil die Anwendungen bereits über Service-Schnittstellen kommunizieren.

## Kleine Infrastruktur ist trotzdem echte Infrastruktur

Ein einzelner VPS wird im Vergleich zu einem Cloud-Cluster manchmal als „nicht Produktion“ abgetan.

Ich denke, das übersieht das interessante Engineering-Problem.

Der Server braucht weiterhin:

```text
TLS
Netzwerkisolation
persistenten Speicher
Backups
Hintergrundverarbeitung
Datenbanken
Deployment
Monitoring
Fehlerwiederherstellung
Ressourcenmanagement
```

Die Größenordnung ist kleiner.

Die Verantwortung ist real.

Tatsächlich macht die Einschränkung architektonische Fehler schnell sichtbar.

Ein schlecht begrenzter Worker-Pool verbraucht den gesamten verfügbaren RAM.

Ein unbegrenzter Datenbank-Pool erzeugt Verbindungsdruck.

Vergessene Docker-Images füllen den Datenträger.

Eine öffentlich erreichbare Redis-Instanz erzeugt ein unnötiges Sicherheitsrisiko.

Es gibt wenig überschüssige Kapazität, die solche Entscheidungen verstecken könnte.

## Die Architektur, die ich möchte, ist langweilig

Das Endziel ist nicht zu zeigen, wie viele Infrastrukturtechnologien ich betreiben kann.

Es ist:

```text
git push / deploy
       |
       v
Anwendung startet
       |
       v
Nginx routet Traffic
       |
       v
private Services kommunizieren
       |
       v
Hintergrundjobs werden ausgeführt
       |
       v
Zustand wird gesichert
```

Wenn etwas ausfällt, möchte ich wissen, welche Grenze für das Problem verantwortlich ist.

Ein kleiner Server belohnt diese Einfachheit.

Mehrere ML-Anwendungen mit 8 GB zu betreiben ist nicht möglich, weil die Maschine außergewöhnlich leistungsfähig wäre, sondern weil die Architektur nicht vorgibt, jedes Projekt brauche Hyperscale-Infrastruktur.

Für die Größenordnung, in der ich aktuell entwickle, gibt mir dieser Trade-off etwas Wertvolleres als eine komplizierte Plattform:

eine Produktionsumgebung, die ich Ende zu Ende verstehe.
