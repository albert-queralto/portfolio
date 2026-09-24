---
title: "Ein Multi-Tenant-SaaS mit FastAPI und PostgreSQL entwickeln"
description: "Wie ich Workspace-Isolation, Berechtigungen, Hintergrundjobs, Abrechnung und Audit-Zustand strukturiere, wenn aus einer FastAPI-Anwendung ein Multi-Tenant-SaaS wird."
date: 2026-10-12
publishAt: 2026-10-12T08:00:00+02:00
lang: de
translationKey: multi-tenant-fastapi-postgresql-saas
tags: ["FastAPI", "PostgreSQL", "SaaS", "Python", "Security", "Backend"]
draft: false
cover: "/og/multi-tenant-fastapi-postgresql-saas.png"
featured: false
project: "tenderwise"
---

Authentifizierung zu einer Anwendung hinzuzufügen macht sie nicht automatisch multi-tenant-fähig.

Ein Benutzerkonto beantwortet:

> Wer stellt diese Anfrage?

Eine SaaS-Anwendung muss zusätzlich beantworten:

> Auf die Daten welcher Organisation darf dieser Benutzer zugreifen und Operationen ausführen?

Diese zweite Frage hat einen großen Teil des Backend-Designs von **TenderWise** geprägt.

TenderWise ist um Workspaces organisiert. Unternehmensprofile, Vergabeentscheidungen, Bid-Workspaces, Teamaktivität, Abrechnungslimits und Audit-Ereignisse existieren jeweils im Kontext eines Tenants.

Die architektonische Regel ist einfach:

> Ein Workspace ist eine Sicherheitsgrenze, nicht nur eine Gruppierung in der Benutzeroberfläche.

## Das grundlegende Datenmodell

Auf konzeptioneller Ebene:

```text
User
 |
 v
WorkspaceMembership
 |
 +---- role
 |
 v
Workspace
 |
 +---- company profiles
 +---- assessments
 +---- bid workspaces
 +---- tasks
 +---- notifications
 +---- usage state
 +---- audit events
```

Benutzer und Workspaces sind getrennte Entitäten, weil ihre Beziehung many-to-many ist.

Ein Benutzer kann mehreren Workspaces angehören.

Ein Workspace kann mehrere Benutzer enthalten.

Der Membership-Datensatz ist deshalb der Ort, an den der Autorisierungskontext gehört.

## Authentifizierung und Tenant-Autorisierung sind verschieden

Die Authentifizierung kann Folgendes liefern:

```python
current_user
```

ein Workspace-Endpunkt benötigt jedoch mehr Kontext:

```python
current_user
current_workspace
membership
role
```

Eine vereinfachte FastAPI-Dependency könnte konzeptionell so aussehen:

```python
async def require_workspace_member(
    workspace_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    membership = await find_membership(
        session,
        workspace_id=workspace_id,
        user_id=current_user.id,
    )

    if membership is None:
        raise HTTPException(status_code=404)

    return membership
```

Ich bevorzuge bewusst Autorisierung an der Anfragegrenze, statt darauf zu hoffen, dass jeder nachgelagerte Service daran denkt, sie erneut zu prüfen.

## Jede Tenant-Abfrage sollte einen offensichtlichen Scope haben

Die gefährliche Abfrage ist:

```python
select(BidWorkspace).where(
    BidWorkspace.id == bid_id
)
```

weil die Objekt-ID zur einzigen Grenze wird.

Das sicherere mentale Modell ist:

```python
select(BidWorkspace).where(
    BidWorkspace.id == bid_id,
    BidWorkspace.workspace_id == workspace.id,
)
```

Selbst wenn IDs schwer zu erraten sind, sollte Autorisierung nicht auf Geheimhaltung beruhen.

Dieses Prinzip sollte konsequent gelten für:

- Profile,
- Assessments,
- Aufgaben,
- Kommentare,
- Benachrichtigungen,
- Nutzungsdatensätze,
- und Abrechnungszustand.

Wenn ein Objekt zu einem Tenant gehört, sollte der Tenant-Scope in der Abfrage sichtbar oder durch die verwendete Service-Abstraktion garantiert sein.

## Eine Tenant-ID niemals als Autorisierung behandeln

Der Browser muss natürlich erkennen können, welcher Workspace aktiv ist.

Das Backend sollte jedoch:

```json
{ "workspace_id": "..." }
```

nicht als Autorisierung interpretieren.

Die Workspace-ID sagt, welchen Tenant der Benutzer verwenden möchte.

Die Membership-Prüfung sagt, ob er ihn verwenden darf.

Aufgeschrieben wirkt das offensichtlich. Bei Dutzenden Endpunkten und Hintergrundprozessen wird es schnell weniger offensichtlich.

## Rollenprüfungen sollten auf Membership aufbauen

Sobald die Membership festgestellt ist, können Rollen engere Fragen beantworten:

```text
Darf diese Person Mitglieder einladen?
Darf diese Person die Abrechnung ändern?
Darf diese Person eine Bid-Entscheidung ändern?
Darf diese Person den Workspace nur ansehen?
```

Ich bevorzuge eine kleine Menge expliziter Rollen und Berechtigungsprüfungen gegenüber verstreuten Bedingungen.

Autorisierungslogik sollte langweilig aussehen.

Langweilige Autorisierung lässt sich leichter auditieren.

## Hintergrundjobs brauchen ebenfalls Tenant-Kontext

Multi-Tenancy wird interessanter, wenn eine Anfrage asynchrone Arbeit in eine Queue legt.

Zum Beispiel:

```text
browser
  |
  v
FastAPI
  |
  v
Celery
  |
  v
generate tender brief
```

Der Worker läuft nicht mehr im Autorisierungskontext der ursprünglichen HTTP-Anfrage.

Die Task benötigt deshalb genügend Identifikatoren, um den korrekten serverseitigen Scope wiederherzustellen.

Ein nützliches Muster ist, stabile interne IDs in die Queue zu geben:

```python
generate_brief.delay(
    workspace_id=str(workspace.id),
    assessment_id=str(assessment.id),
)
```

Der Worker lädt anschließend das Assessment eingeschränkt auf den angegebenen Workspace.

Er sollte keinen beliebigen serialisierten Benutzerdaten vertrauen, die vom Frontend gesendet wurden.

Tenant-Isolation muss den Übergang von HTTP-Anfrage zu asynchronem Prozess überleben.

## Abrechnung ist ebenfalls Tenant-Zustand

Abonnements sind normalerweise Eigenschaften eines Workspaces oder einer Organisation und nicht einzelner API-Anfragen.

Das bedeutet, dass das Backend manchmal drei getrennte Fragen beantworten muss:

```text
Ist dieser Benutzer authentifiziert?
Ist dieser Benutzer in diesem Workspace autorisiert?
Ist dieser Workspace zu dieser Operation berechtigt?
```

Das sind unterschiedliche Entscheidungen.

Sie in einer großen Dependency zusammenzufassen wird mit der Zeit schwer wartbar, deshalb halte ich die Konzepte lieber getrennt.

## Audit-Logs benötigen dieselbe Grenze

Verändernde Workspace-Aktionen können aufgezeichnet werden mit:

```text
actor
workspace
Aktion
Objekttyp
Objekt-ID
Zeitstempel
Metadaten
```

Das Feld `workspace` ist genauso wichtig wie der Actor.

Ein Plattformadministrator muss möglicherweise Aktivität über mehrere Tenants hinweg einsehen, während ein normaler Workspace-Administrator nur Ereignisse seiner eigenen Organisation sehen sollte.

Auch Audit-Daten benötigen daher Tenant-Isolation.

## Tenant-Fehler brauchen negative Tests

Die wichtigsten Tests lauten nicht:

> Kann Alice Alices Bid laden?

Sondern:

> Kann Alice Bobs Bid laden, wenn sie die ID kennt?

Für Tenant-sensitive Ressourcen möchte ich Tests, die explizit zwei Workspaces erstellen:

```text
Workspace A
    User A
    Bid A

Workspace B
    User B
    Bid B
```

und anschließend Folgendes versuchen:

```text
User A -> Bid B
```

Das erwartete Ergebnis ist immer eine Ablehnung.

Ähnliche Tests sollten existieren für:

- Updates,
- Löschvorgänge,
- Hintergrundjobs,
- Admin-Routen,
- Abrechnungsänderungen,
- und Teameinladungen.

Eine Multi-Tenant-Anwendung braucht Isolationstests genauso wie eine Scoring-Engine Korrektheitstests braucht.

## PostgreSQL macht explizite Eigentümerschaft praktikabel

Ein Vorteil einer relationalen Datenbank besteht darin, dass Tenant-Beziehungen direkt modelliert werden können.

Zum Beispiel:

```text
workspace
    |
    +-- profiles
    |
    +-- bids
          |
          +-- tasks
```

Fremdschlüssel erschweren es, ungültige Beziehungen zu erzeugen.

Indizes mit `workspace_id` können außerdem die Zugriffsmuster der API unterstützen.

Das Datenbankschema wird damit Teil der Sicherheitsarchitektur und ist nicht nur persistenter Speicher.

## Backups verändern sich bei einer gemeinsam genutzten Datenbank

Eine gemeinsam genutzte PostgreSQL-Datenbank kann Daten vieler Workspaces enthalten.

Dadurch wird die Integrität von Backups besonders wichtig.

Eine Backup-Strategie ist nicht vollständig, nur weil eine Datei erzeugt wurde.

Die eigentlichen Fragen lauten:

```text
Kann das Backup wiederhergestellt werden?
Wie viele Kopien werden aufbewahrt?
Wie viel Speicherplatz verbrauchen sie?
Was passiert, wenn die aktuelle Datenbank nicht mehr verfügbar ist?
```

Multi-Tenancy vergrößert den Schadensradius eines Datenbankausfalls, daher verdient Recovery dieselbe Aufmerksamkeit.

## Die wichtigste Lehre

Multi-Tenancy ist keine Funktion, die ich am Ende hinzufügen würde.

Sie beeinflusst:

```text
Datenbankschema
API-Dependencies
Autorisierung
Hintergrundtasks
Abrechnung
Audit-Logs
Tests
Backups
```

Die einfachste Regel, die ich gefunden habe, lautet:

> Jede Operation auf Tenant-eigenen Daten sollte die Tenant-Grenze offensichtlich machen.

Wenn diese Regel konsequent angewendet wird, bieten FastAPI und PostgreSQL eine sehr gute Grundlage für kleine und mittlere SaaS-Systeme.

Der schwierige Teil ist nicht das Framework.

Es ist, die Grenze überall einzuhalten.
