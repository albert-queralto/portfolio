---
title: "TenderWise entwickeln: regelbasierte Bid/No-Bid-Intelligenz für europäische Ausschreibungen"
description: "Wie ich TenderWise als mehrsprachiges SaaS für öffentliche Beschaffung entwickelt habe, das TED-Bekanntmachungen einliest, deterministisches Profil-Matching anwendet, Relevanz von Qualifikation trennt und Ausschreibungsanalyse in kollaborative Angebotsvorbereitung überführt."
date: 2026-08-10
lang: de
translationKey: tenderwise
tags:
  [
    "Software Engineering",
    "FastAPI",
    "React",
    "PostgreSQL",
    "Procurement",
    "SaaS",
  ]
draft: false
cover: "/og/tenderwise.png"
featured: true
project: "tenderwise"
---

Software für die öffentliche Beschaffung hat eine andere Art von Fehlermodus als viele Analyseprodukte.

Die schwierige Aufgabe besteht nicht nur darin, Chancen zu finden. Ein Team muss entscheiden können, ob eine Ausschreibung den Aufwand für die Angebotserstellung rechtfertigt, und gleichzeitig genügend Nachweise behalten, damit die Entscheidung später überprüft werden kann.

Genau dieses Problem adressiert **TenderWise**, ein mehrsprachiges SaaS für die europäische öffentliche Beschaffung. Es liest TED-Bekanntmachungen ein, normalisiert sie zu strukturierten Opportunities, filtert sie anhand von Unternehmensprofilen, trennt strategische Relevanz von Qualifikationsbereitschaft und überführt die abschließende Entscheidung in einen kollaborativen Bid-Workspace.

Dieser Artikel beschreibt das technische Design:

1. TED-Bekanntmachungen zu Opportunities normalisieren
2. Unternehmensprofile mit Ländern, CPV-Codes und Auftragswerten abgleichen
3. Relevanz mit aktiven gewichteten Dimensionen bewerten
4. Verbindliche Qualifikationsanforderungen auswerten
5. Empfehlungen als `BID`, `REVIEW` und `NO_BID` erzeugen
6. KI-Zusammenfassungen deterministischen Regeln unterordnen
7. Die Entscheidung mit Angebotsausführung und SaaS-Betrieb verbinden

Die Kernidee ist einfach: Wenn Eignung und Angebotsaufwand auf dem Spiel stehen, sollte ein System erklärbar sein, bevor es clever ist.

## Das Produktproblem

Ein Beschaffungsteam, das Ausschreibungen prüft, stellt gewöhnlich mehrere Fragen gleichzeitig:

- Passt diese Opportunity zu unseren Zielmärkten?
- Ist der CPV-Umfang für unser Angebot relevant?
- Rechtfertigt der Auftragswert den Aufwand?
- Gibt es harte Ausschlüsse, die die Ausschreibung irrelevant machen?
- Erfüllen wir verbindliche Anforderungen wie Umsatz, Teamgröße oder Zertifizierungen?
- Wer muss die eigentliche Antwort vorbereiten, wenn wir ein Angebot abgeben?

Es ist verlockend, all diese Fragen in einen einzigen Score zu verdichten. TenderWise tut das nicht.

Das System trennt bewusst:

- **Discovery-Matching**: Soll die Opportunity überhaupt in den Feed gelangen?
- **Relevanz-Scoring**: Ist sie strategisch attraktiv?
- **Qualifikations-Scoring**: Kann das Unternehmen die bekannten verbindlichen Kriterien erfüllen?
- **Bid-Ausführung**: Wie bereitet das Team die Antwort vor?

Diese Trennung ist die Architektur.

## Normalisierung von TED-Bekanntmachungen

TenderWise verwendet die TED Search API für die Entdeckung, behandelt jedoch das kanonische TED-XML als maßgebliche Quelle für Opportunity-Details.

Der Ingestion-Flow lautet:

```text
TED Search API
    -> publication numbers and format links
    -> canonical XML retrieval
    -> checksum and source-version storage
    -> lot-level normalization
    -> requirement extraction
    -> opportunity upsert
    -> watcher notifications when notice content changes
```

Jeder XML-Payload erhält eine SHA-256-Prüfsumme. Existiert diese Prüfsumme für die Publikationsnummer bereits, hat sich die Bekanntmachung nicht geändert und die Ingestion kann den aufwendigen Pfad überspringen.

```python
import hashlib


def notice_checksum(xml_payload: str) -> str:
    return hashlib.sha256(xml_payload.encode("utf-8")).hexdigest()
```

Ist die Prüfsumme neu, speichert TenderWise einen `SourceNoticeVersion`-Datensatz und normalisiert das XML in ein oder mehrere Lose. Eine einzelne TED-Bekanntmachung kann mehrere Lose beschreiben, deshalb ist das Anwendungsmodell losorientiert und nicht bekanntmachungsorientiert.

```python
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal


@dataclass(slots=True)
class NormalizedLot:
    lot_id: str
    title: str
    description: str | None
    buyer_name: str | None
    country_codes: list[str]
    cpv_codes: list[str]
    estimated_value: Decimal | None
    currency: str
    deadline: datetime | None
    source_language: str | None
    requirements: list["ParsedRequirement"] = field(default_factory=list)
```

Der Normalizer bevorzugt lokalisierten Text in der Quellsprache und verwendet Fallbacks, wenn das bevorzugte Feld fehlt. Außerdem werden TED-Ländercodes in die zweibuchstabigen Codes umgewandelt, die UI und Unternehmensprofile verwenden.

Das ist wichtig, weil der nachgelagerte Scoring-Code nicht wissen sollte, ob eine Bekanntmachung `ESP`, `ES` oder einen verschachtelten XML-Pfad verwendet hat. Er sollte ein sauberes Opportunity-Objekt erhalten.

## Anforderungen aus Ausschreibungstexten extrahieren

TenderWise extrahiert strukturierte Qualifikationsanforderungen aus TED-Auswahlkriterien. Einige Anforderungen lassen sich in maschinell prüfbare Werte überführen:

- Mindestjahresumsatz
- Mindestteamgröße
- benannte Zertifizierungen wie ISO-Normen
- Mindestanzahl vergleichbarer Verträge

Der Parser behält dennoch die ursprüngliche Beschreibung und den Quellpfad, weil nicht jede Beschaffungsanforderung zuverlässig als vollständig strukturierte Daten behandelt werden kann.

```python
import re
from decimal import Decimal


def infer_requirement(description: str) -> tuple[str, dict]:
    certification = re.search(
        r"\b(ISO\s*\d{4,5}(?::\d{4})?|EMAS|EN\s*ISO\s*\d{4,5})\b",
        description,
        re.IGNORECASE,
    )
    if certification:
        return "certification", {
            "name": certification.group(1).upper().replace("  ", " "),
        }

    turnover = re.search(
        r"(?:turnover|annual revenue|facturaci[oó]n|volumen de negocios|umsatz)"
        r"[^\d€]{0,80}(?:€|EUR)?\s*([\d.,]+)\s*(million|millones?|mio|m)?",
        description,
        re.IGNORECASE,
    )
    if turnover:
        amount = Decimal(turnover.group(1).replace(",", "."))
        if turnover.group(2):
            amount *= Decimal("1000000")
        return "minimum_annual_turnover", {
            "amount": str(amount),
            "currency": "EUR",
        }

    return "manual_review", {}
```

Die tatsächliche Implementierung geht defensiver mit Dezimalformaten und Sprachvarianten um. Das Designprinzip bleibt jedoch gleich: Nur das extrahieren, was erklärt werden kann, und den Rest als überprüfbare Evidenz belassen.

## Profil-Matching vor dem Scoring

Bevor eine Opportunity bewertet wird, prüft TenderWise, ob sie die harten Discovery-Regeln des Unternehmensprofils erfüllt.

Profile können enthalten:

| Profilfeld | Funktion |
| --- | --- |
| `country_codes` | Zielländer |
| `excluded_country_codes` | Harte geografische Ausschlüsse |
| `cpv_codes` | Ziel-CPV-Familien |
| `excluded_cpv_codes` | Harte CPV-Ausschlüsse |
| `preferred_min_value` / `preferred_max_value` | Bevorzugter Auftragswertbereich |
| `preferred_currency` | Währung für den Wertvergleich |

Die Matching-Semantik ist bewusst explizit:

- OR innerhalb einer Dimension: Jedes Zielland kann passen.
- AND zwischen Dimensionen: Länder-, CPV- und Wertregeln müssen alle bestehen.
- Ausschlüsse haben Vorrang vor Einschlüssen.
- Unbekannte Werte bleiben sichtbar, statt stillschweigend verworfen zu werden.
- Nicht vergleichbare Währungen erzeugen Warnungen statt Scheingenauigkeit.

CPV-Matching braucht eine besondere Behandlung, weil CPV-Codes hierarchisch sind.

```python
def normalize_cpv(code: str) -> str:
    digits = "".join(character for character in code if character.isdigit())
    return digits[:8]


def cpv_matches(profile_code: str, notice_code: str) -> bool:
    profile = normalize_cpv(profile_code)
    notice = normalize_cpv(notice_code)

    if not profile or not notice:
        return False

    significant_prefix = profile.rstrip("0") or profile
    return notice.startswith(significant_prefix)
```

Ein Profilcode wie `71320000` repräsentiert eine breitere Familie. Eine Bekanntmachung mit `71321000` sollte weiterhin als relevant gelten, weil sie unter diese Familie fällt.

Die Ausgabe des Discovery-Matchings ist nicht nur ein Boolean. TenderWise liefert zusätzlich ein Erklärungsobjekt mit passenden Ländern, passenden CPVs, Ausschlüssen, Wertstatus und dem Grund, warum ein Auftragswert vergleichbar war oder nicht.

## Relevanz ist ein strategischer Fit-Score

Nachdem eine Opportunity die harten Discovery-Gates überstanden hat, bewertet TenderWise ihre strategische Relevanz.

Relevanz ist keine Eignung. Sie beantwortet:

> Sollte diese Opportunity weit oben im Feed des Teams stehen?

Die Scoring-Funktion bewertet nur Dimensionen, die im Profil konfiguriert sind. Hat ein Unternehmen beispielsweise keine Zielbranchen hinterlegt, verwässert diese fehlende Dimension den Score nicht.

Mathematisch:

$$
\text{relevance} =
\frac{\sum_i w_i s_i}{\sum_i w_i}
$$

wobei jede aktive Dimension ein Gewicht $(w_i)$ und einen Score $(s_i)$ von 0 bis 100 hat.

TenderWise verwendet Dimensionen wie:

| Dimension | Typisches Gewicht | Signal |
| --- | ---: | --- |
| CPV-Ausrichtung | 35 | exakter, Familien- oder breiter Familien-Match |
| Geografie | 20 | Match mit einem Zielland |
| Auftragswert | 15 | bevorzugter Bereich und Währungsvergleichbarkeit |
| Services | 20 | Servicebegriffe in Titel, Auftraggeber oder Zusammenfassung |
| Branchen | 10 | Branchenbegriffe im Bekanntmachungstext |

Die Implementierung bewahrt Blocker, Warnungen und Stärken zusammen mit dem Score auf:

```python
from dataclasses import dataclass


@dataclass(slots=True)
class RelevanceResult:
    score: float
    breakdown: dict[str, float]
    blockers: list[str]
    warnings: list[str]
    strengths: list[str]
    evidence_sufficient: bool
```

Diese Form ist nützlicher als eine Zahl allein. Ein Score von 78 mit „nur breiter CPV-Familien-Ausrichtung“ bedeutet etwas anderes als 78 mit exaktem CPV-Match, aber unbekanntem Auftragswert.

## Qualifikation ist ein Bereitschafts-Score

Qualifikation beantwortet eine andere Frage:

> Kann dieses Unternehmen die bekannten verbindlichen Anforderungen erfüllen?

TenderWise bewertet jede extrahierte Anforderung gegen das ausgewählte Unternehmensprofil.

```python
from dataclasses import dataclass
from decimal import Decimal
from typing import Literal


RequirementStatus = Literal["PASS", "FAIL", "UNKNOWN", "NOT_APPLICABLE"]


@dataclass(slots=True)
class RequirementEvaluation:
    status: RequirementStatus
    reason: str
    evidence: str | None = None


def evaluate_turnover(profile, requirement) -> RequirementEvaluation:
    required = Decimal(str(requirement.structured_value.get("amount", 0)))

    if profile.annual_turnover is None:
        return RequirementEvaluation(
            "UNKNOWN",
            "Annual turnover is missing from the profile",
        )

    if profile.annual_turnover >= required:
        return RequirementEvaluation(
            "PASS",
            "Company turnover meets the threshold",
            f"Profile turnover: {profile.annual_turnover}",
        )

    return RequirementEvaluation(
        "FAIL",
        f"Required annual turnover is {required}",
        f"Profile turnover: {profile.annual_turnover}",
    )
```

Die Ergebnisse verbindlicher Anforderungen werden auf Score-Beiträge abgebildet:

| Bewertung | Score-Beitrag |
| --- | ---: |
| `PASS` | 100 |
| `UNKNOWN` | 50 |
| `FAIL` | 0 |

Unbekannte Werte werden bewusst nicht als Fehler behandelt. Ein fehlendes Feld im Unternehmensprofil kann bedeuten, dass das Unternehmen nicht qualifiziert ist; es kann aber auch bedeuten, dass dem System die Evidenz noch fehlt.

Dieser Unterschied ist der Grund, weshalb TenderWise `REVIEW` empfehlen kann, statt sofort zu `NO_BID` zu springen.

## Relevanz und Qualifikation kombinieren

TenderWise kombiniert beide Achsen in einer deterministischen Empfehlungsfunktion.

Die Endzustände sind:

- `BID`: starker strategischer Fit und ausreichende Qualifikationsevidenz
- `REVIEW`: vielversprechend, aber unvollständig, mehrdeutig oder unter den automatischen Bid-Schwellen
- `NO_BID`: geschlossene Opportunity, harter Ausschluss, verbindlicher Blocker, geringe Relevanz oder geringe Qualifikationsbereitschaft

Die vereinfachte Entscheidungslogik sieht so aus:

```python
def recommend(relevance, qualification, opportunity):
    if opportunity.status == "CLOSED" or opportunity.deadline_has_passed:
        return "NO_BID", "The opportunity is closed or expired"

    if relevance.blockers:
        return "NO_BID", "A configured market or CPV exclusion applies"

    if qualification.blockers:
        return "NO_BID", "At least one mandatory criterion fails"

    if relevance.score < 40:
        return "NO_BID", "Strategic relevance is too low"

    if qualification.score < 45:
        return "NO_BID", "Qualification readiness is too low"

    if qualification.has_unknown_mandatory:
        return "REVIEW", "Mandatory evidence needs manual verification"

    if relevance.score >= 70 and qualification.score >= 80:
        return "BID", "Relevance and qualification jointly support a bid"

    return "REVIEW", "The opportunity should be reviewed before bid effort"
```

Das ist bewusst weniger mysteriös als ein Black-Box-Empfehlungsmodell.

In der Beschaffung kann ein falsches automatisches `BID` Tage an Arbeit verschwenden. Ein falsches automatisches `NO_BID` kann Umsatzchancen verbergen. Deshalb bevorzugen die Regeln eine auditierbare Prüfung, wenn wichtige Evidenz fehlt.

## Warum KI die Empfehlung nicht überschreibt

TenderWise unterstützt optionale KI-generierte Ausschreibungsbriefings, aber die KI-Schicht liegt nach dem deterministischen Scoring.

Die KI kann erzeugen:

- eine Executive Summary
- wichtige Punkte
- Risiken und Unbekannte
- vorgeschlagene nächste Schritte
- verständliche Erklärungen extrahierter Anforderungen

Sie kann den Relevanz-Score, Qualifikations-Score, die Anforderungsbewertung oder die Empfehlung nicht verändern.

Der KI-Input enthält die deterministische Bewertung als strukturierten Kontext:

```python
payload = {
    "tender": {
        "title": opportunity.title,
        "buyer": opportunity.buyer_name,
        "countries": opportunity.country_codes,
        "cpv_codes": opportunity.cpv_codes,
        "deadline": opportunity.deadline.isoformat() if opportunity.deadline else None,
    },
    "company_profile": {
        "services": profile.services,
        "certifications": profile.certifications,
        "annual_turnover": str(profile.annual_turnover)
        if profile.annual_turnover
        else None,
    },
    "deterministic_assessment": {
        "relevance_score": assessment.relevance_score,
        "qualification_score": assessment.qualification_score,
        "recommendation": assessment.recommendation,
        "recommendation_reasons": [
            reason.model_dump()
            for reason in assessment.recommendation_reasons
        ],
    },
}
```

Dadurch bleibt das generierte Briefing in der richtigen Rolle: erklärende Unterstützung, nicht Entscheidungsautorität.

Die KI-Pipeline verwendet außerdem einen Content-Hash:

```text
prompt version
provider name
model name
tender/profile input
source notice version
profile updated timestamp
    -> SHA-256 input hash
```

Ändert sich eine dieser Eingaben, werden gecachte Briefings veraltet. So wird verhindert, dass nach Änderungen an Bekanntmachung, Profil, Provider oder Modell eine alte Zusammenfassung als aktuell angezeigt wird.

## Lange KI-Anfragen begrenzen

TED-Bekanntmachungen können sehr umfangreich sein. Manche enthalten lange Beschreibungen und viele Auswahlkriterien. TenderWise kürzt den KI-Input deshalb schichtweise, anstatt den gesamten Datenbankdatensatz an einen Provider zu senden.

Die Budgetstrategie lautet:

1. Mit einem strukturierten Payload beginnen.
2. Die Ausschreibungsbeschreibung kürzen, wenn der Payload zu groß ist.
3. Überschüssige Anforderungen entfernen und mindestens eine behalten.
4. Anforderungsbeschreibungen und Evidenz kürzen.
5. Profiltexte und lange Listenfelder kürzen.
6. Explizit fehlschlagen, wenn der Payload weiterhin `AI_MAX_INPUT_CHARS` überschreitet.

Dabei geht es nicht nur um Provider-Kosten. Es schützt auch die Latenz und hält Browser-Anfragen responsiv, weil die Generierung in einem Celery-Worker statt innerhalb der HTTP-Anfrage stattfindet.

```text
Browser clicks "Generate AI brief"
    -> API validates entitlement and queues task
    -> Celery worker builds deterministic context
    -> worker calls Ollama or OpenAI-compatible provider
    -> JSON output is validated with Pydantic
    -> result is cached against the input hash
```

## Von der Entscheidung zum Bid-Workspace

Eine Empfehlung ist nur dann nützlich, wenn sie die nächste Aktion des Teams verändert.

TenderWise verbindet jede Opportunity und jedes Unternehmensprofil mit einem Bid-Workspace. Dieser verfolgt:

- kommerziellen Entscheidungsstatus
- Workflow-Phase
- interne Deadline
- benannte Zuweisungen im Bid-Team
- Aufgaben-Checkliste
- aus Anforderungen erzeugte Aufgaben
- Kommentare
- Fertigstellungsfortschritt

Die Fortschrittsberechnung ist klein, aber wichtig:

```python
from datetime import UTC, datetime


def calculate_progress(items):
    now = datetime.now(UTC)
    total = len(items)
    completed = sum(item.status == "DONE" for item in items)
    blocked = sum(item.status == "BLOCKED" for item in items)
    overdue = sum(
        item.status != "DONE"
        and item.due_at is not None
        and item.due_at < now
        for item in items
    )
    percent = round((completed / total) * 100) if total else 0

    return {
        "total": total,
        "completed": completed,
        "blocked": blocked,
        "overdue": overdue,
        "percent": percent,
    }
```

Das ist bewusst operativ. Ein Beschaffungsteam braucht nicht nur einen Score; es braucht eine Möglichkeit, Arbeit zuzuweisen und zu sehen, ob das Angebot einreichungsreif wird.

## Hintergrundjobs und Fehlerwiederherstellung

TenderWise nutzt Celery für Arbeit, die Benutzeranfragen nicht blockieren sollte:

- TED-Synchronisierung
- erneute Verarbeitung fehlgeschlagener TED-Bekanntmachungen
- Schließen oder Bereinigen abgelaufener Opportunities
- E-Mails für Teameinladungen
- geplante Digests
- Generierung von KI-Ausschreibungsbriefings
- Aufzeichnung von Worker-Heartbeats

Fehlgeschlagene TED-Bekanntmachungen werden mit Versuchszahl, Fehlertext, Status und nächster Wiederholungszeit persistiert. Wiederholungsverzögerungen verwenden begrenztes exponentielles Backoff:

```python
from datetime import timedelta


def retry_delay(attempt_count: int) -> timedelta:
    hours = min(24, 2 ** max(0, attempt_count - 1))
    return timedelta(hours=hours)
```

Das ist ein einfaches Muster, verändert aber das Zuverlässigkeitsprofil des Systems. Ein vorübergehendes Problem beim XML-Abruf sollte zu einem beobachtbaren Retry-Zustand werden und nicht zu einer verlorenen Ausschreibung.

## Deployment-Grenzen

In Produktion befindet sich TenderWise hinter demselben gemeinsamen Nginx- und Certbot-Edge-Stack wie die übrige Portfolio-Infrastruktur.

```text
Internet
    |
    | https://tenderwise.albertqueralto.dev
    v
Shared Nginx + Certbot edge
    |
    v
tenderwise-web:80
    |-- React static application
    |
    `-- /api/* -> FastAPI
                    |
                    |-- PostgreSQL + pgvector
                    |-- Redis
                    |-- Celery worker
                    |-- Celery Beat
                    |-- backup sidecar
                    `-- optional Ollama container
```

Nur der Web-Container tritt dem öffentlichen Proxy-Netzwerk bei. PostgreSQL, Redis, FastAPI, Worker, Scheduler, Backups und Ollama bleiben im privaten Compose-Netzwerk von TenderWise.

Diese Grenze hält das Deployment im besten Sinne langweilig: Der öffentliche Edge hat eine Aufgabe, das Anwendungsnetzwerk eine andere, und zustandsbehaftete Dienste veröffentlichen keine Host-Ports.

## Die Regeln testen

Auch regelbasierte Systeme benötigen Tests. TenderWise hat fokussierte Backend-Tests für:

- TED-Parsing und Speicherung
- Profil-Matching
- Relevanz-Scoring
- Qualifikationsbewertung
- Payloads für KI-Insights
- Zustand des Bid-Workspace
- Team-Berechtigungen
- Billing- und Account-Verhalten
- Plattform-Admin-Operationen

Die Tests sind wichtig, weil deterministische Systeme leise regressieren können. Eine kleine Änderung an CPV-Normalisierung, Währungsbehandlung oder Anforderungs-Parsing kann verändern, welche Ausschreibungen in einem Feed erscheinen.

Die wichtigsten Testfälle sind nicht nur Happy Paths. Dazu gehören:

- Matching breiter CPV-Familien
- Vorrang ausgeschlossener CPVs
- unbekannte Auftragswerte
- Währungsinkompatibilitäten
- fehlende Profil-Evidenz
- abgelaufene Deadlines
- fehlgeschlagene verbindliche Anforderungen
- unbekannte verbindliche Anforderungen, die `REVIEW` erzeugen sollen

## Erkenntnisse

### Discovery und Scoring trennen

Ein Discovery-Filter entscheidet, was ins System gelangt. Ein Relevanz-Score ordnet, was übrig bleibt. Werden beide vermischt, lässt sich schwerer erklären, warum eine Opportunity verschwunden ist oder niedrig gerankt wird.

### Qualifikation unabhängig von Relevanz halten

Eine Ausschreibung kann strategisch perfekt sein und trotzdem wegen einer harten Anforderung nicht bid-fähig. Auch das Gegenteil ist möglich: Ein Unternehmen kann für eine Ausschreibung qualifiziert sein, die sich nicht zu verfolgen lohnt.

### Unbekannte Evidenz ist nicht dasselbe wie fehlgeschlagene Evidenz

Beschaffungsentscheidungen hängen häufig von fehlenden oder mehrdeutigen Informationen ab. Unbekanntes als `REVIEW` zu behandeln hält das System nützlich, ohne mehr Wissen vorzutäuschen, als tatsächlich vorhanden ist.

### KI gehört hinter die deterministische Bewertung

Ausschreibungstext kann von Zusammenfassungen profitieren, aber die Empfehlung sollte bis zu Quellfeldern, Profileinstellungen und expliziten Regeln zurückverfolgbar bleiben.

### Operative Funktionen sind Teil des Produkts

Billing-Limits, Audit-Logs, Benachrichtigungen, Backups und Worker-Health sind keine Dekoration. Sie machen ein Entscheidungsunterstützungssystem erst als SaaS tragfähig statt nur als Prototyp.

## Finale Pipeline

Der vollständige TenderWise-Pipeline sieht so aus:

```text
TED Search API
    -> canonical XML retrieval
    -> source-version checksum
    -> lot normalization
    -> requirement parsing
    -> opportunity storage
    -> profile discovery matching
    -> relevance scoring
    -> qualification evaluation
    -> BID / REVIEW / NO_BID recommendation
    -> optional AI brief
    -> bid workspace
    -> notifications, audit logs, billing limits, and worker health
```

Die wichtigste Designentscheidung ist Zurückhaltung.

TenderWise versucht nicht, Beschaffungsentscheidungen magisch zu machen. Es versucht, sie strukturiert, erklärbar, überprüfbar und mit der tatsächlichen Arbeit der Angebotserstellung verbunden zu machen.
