---
title: "TenderWise"
description: "Eine mehrsprachige Beschaffungs-SaaS, die TED-Bekanntmachungen ingestiert, Chancen gegen Unternehmensprofile bewertet, Relevanz und Qualifikation trennt und die Angebotserstellung koordiniert."
lang: de
translationKey: tenderwise
order: 2
featured: true
draft: false
status: "Deployed"
category: "Web"
focus: "Beschaffungs-SaaS · Entscheidungsunterstützung"
image: "/projects/tenderwise/tenderwise.png"
ogImage: "/og/tenderwise.png"
article: "/blog/tenderwise/"
source: "https://github.com/albert-queralto/tender-wise"
preview: "https://tenderwise.albertqueralto.dev/"
technologies:
  - React
  - TypeScript
  - Vite
  - FastAPI
  - PostgreSQL
  - pgvector
  - Redis
  - Celery
  - Docker
  - Stripe
  - Ollama
metrics:
  - label: "Domäne"
    value: "Europäische öffentliche Beschaffung"
  - label: "Entscheidungsmodell"
    value: "Relevanz + Qualifikation"
  - label: "Architektur"
    value: "Multi-Service-SaaS"
---

## Das Problem

Teams in der öffentlichen Beschaffung müssen schnell entscheiden, ob sich ein Ausschreibungsverfahren für ein Angebot lohnt. Die Ausgangsdokumente sind jedoch dicht, mehrsprachig und operativ umständlich.

TED-Bekanntmachungen enthalten wertvolle Signale zu Leistungsumfang, Standort, CPV-Kategorien, Fristen, Käuferkontext, Vertragswert und Pflichtanforderungen. TenderWise überführt diesen Strom in einen Arbeitsbereich, in dem Teams entscheiden können, welche Chancen sie verfolgen und welche Arbeit für ein Angebot erforderlich ist.

## Mein Ansatz

TenderWise trennt Discovery, Entscheidungsunterstützung und Angebotsausführung.

Das System ingestiert TED-Bekanntmachungen, normalisiert sie zu strukturierten Chancen, gleicht sie mit Unternehmensprofilen ab und bewertet anschließend zwei unterschiedliche Fragen:

- Ist die Chance strategisch relevant?
- Kann das Unternehmen die bekannten Pflichtanforderungen erfüllen?

Diese beiden Achsen speisen eine deterministische Empfehlung `BID`, `REVIEW` oder `NO_BID`. KI kann Ausschreibungsinhalte erklären und zusammenfassen, überschreibt aber nicht die regelbasierte Empfehlung.

## TED-Ingestion

Das Backend integriert die TED Search API und speichert kanonisches TED-XML, damit die Bekanntmachungshistorie nachvollziehbar bleibt. Geparste Datensätze werden zu normalisierten Losen und Chancen, die nach Geografie, CPV-Codes, Wertpräferenzen, Fristen, Quelle, Status und Watchlist-Zustand gefiltert werden können.

TenderWise speichert außerdem Bekanntmachungsversionen und den Zustand fehlgeschlagener Ingestions. Dadurch kann die Plattform transiente Fehler erneut versuchen und Änderungen hervorheben, wenn sich eine Quellbekanntmachung weiterentwickelt.

## Relevanz und Qualifikation

Unternehmensprofile definieren, was für einen Workspace relevant ist: Zielländer, CPV-Präferenzen, Ausschlüsse, Vertragswerte, Fähigkeiten, Zertifizierungen und weitere Qualifikationsnachweise.

Relevanz-Scoring beantwortet, ob die Chance in den Feed des Teams gehört. Qualifikations-Scoring beantwortet, ob das Team die bereits extrahierten Pflichtanforderungen voraussichtlich erfüllen kann.

Die Trennung dieser Konzepte macht die Empfehlung besser auditierbar. Eine Ausschreibung kann strategisch attraktiv sein und trotzdem eine Prüfung benötigen, weil eine Pflichtanforderung unbekannt ist oder Nachweise fehlen.

## Angebotsarbeitsbereich

Wenn eine Chance verfolgt oder geprüft werden soll, erstellt TenderWise einen kollaborativen Angebotsarbeitsbereich.

Der Workspace verfolgt Workflow-Stufen, interne Fristen, benannte Bid-Team-Rollen, Vorbereitungsaufgaben, vorbefüllte Anforderungschecklisten, Zuständigkeiten, Fortschritt und Teamkommentare. So bleibt das Entscheidungssystem mit der operativen Arbeit verbunden, die vor der Einreichung nötig ist.

## SaaS-Betrieb

TenderWise umfasst die Produktinfrastruktur rund um den Workflow:

- Workspace-Mitgliedschaft und rollenbasierte Berechtigungen
- Erst-Onboarding
- Stripe-Abonnementstatus und Nutzungslimits
- Audit-Logs für mutierende Workspace-Aktionen
- In-App-Benachrichtigungen für Billing-, TED- und Bid-Ereignisse
- Produktions-Health-Sichtbarkeit und geplante PostgreSQL-Backups

Diese Bausteine machen das Projekt zu mehr als einem Ausschreibungsparser. Es verhält sich wie eine wartbare SaaS-Anwendung mit operativen Grenzen, Quoten und Recovery-Pfaden.

## Optionale KI-Briefings

KI-Briefings zu Ausschreibungen werden über Celery in die Queue gestellt, statt den Browser zu blockieren. Wenn aktiviert, kann TenderWise eine Executive Summary, Schlüsselpunkte, Risiken, Unbekannte, vorgeschlagene nächste Schritte und verständliche Erklärungen der Anforderungen erzeugen.

Der KI-Anbieter ist konfigurierbar: Ein lokaler Ollama-Container kann in Docker Compose genutzt werden, oder der Worker ruft einen OpenAI-kompatiblen Provider auf. Gecachte Briefings werden als veraltet markiert, wenn sich Modell- oder Providerkonfiguration ändern.

## Architektur

Das Produktionsdeployment nutzt einen gemeinsamen Nginx-/Certbot-Edge-Stack für `tenderwise.albertqueralto.dev`.

Hinter dieser öffentlichen Schicht wird die React-Anwendung von einem Webcontainer ausgeliefert und leitet API-Anfragen an FastAPI weiter. PostgreSQL mit pgvector speichert Anwendungsdaten, Redis koordiniert Celery-Jobs, Celery Beat plant Hintergrundarbeit und Worker verarbeiten TED-Ingestion, E-Mail, Digests, Retries und KI-Generierungsaufgaben.

Nur der Webdienst ist mit dem öffentlichen Proxy-Netz verbunden. Datenbank, Redis, API, Worker, Scheduler, Backup-Prozess und optionaler Ollama-Dienst bleiben im privaten TenderWise-Compose-Netz.

## Aktueller Stand

TenderWise ist als produktionsorientiertes SaaS-Projekt bereitgestellt. Die nächsten Produktarbeiten sind die Verfeinerung des Onboardings, die Anpassung der Scoring-Gewichte mit realen Nutzern, der Ausbau des operativen Monitorings und die weitere Verbesserung des Angebotsarbeitsbereichs entsprechend der tatsächlichen Arbeitsweise von Beschaffungsteams.
