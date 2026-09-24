---
title: "Construint TenderWise: intel·ligència basada en regles per decidir Bid/No-Bid en licitacions europees"
description: "Com vaig dissenyar TenderWise com un SaaS multilingüe de contractació pública que ingereix anuncis TED, aplica matching determinista de perfils, separa la rellevància de la qualificació i converteix l'anàlisi de licitacions en preparació col·laborativa d'ofertes."
date: 2026-08-10
lang: ca
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

El programari de contractació pública té un tipus de fallada diferent del de molts productes d'analítica.

La part difícil no és només trobar oportunitats. És ajudar un equip a decidir si una licitació compensa el cost de preparar una oferta, conservant alhora prou evidència perquè la decisió es pugui revisar més endavant.

Aquest és el problema que hi ha darrere de **TenderWise**, un SaaS multilingüe per a la contractació pública europea. Ingesta anuncis TED, els normalitza en oportunitats estructurades, els filtra segons perfils d'empresa, separa la rellevància estratègica de la preparació per complir els requisits i transforma la decisió final en un espai de treball col·laboratiu per preparar l'oferta.

Aquest article recorre el disseny tècnic:

1. Normalitzar anuncis TED en oportunitats
2. Comparar perfils d'empresa amb països, codis CPV i valors de contracte
3. Puntuar la rellevància amb dimensions ponderades actives
4. Avaluar requisits obligatoris de qualificació
5. Produir recomanacions `BID`, `REVIEW` i `NO_BID`
6. Mantenir els resums d'IA subordinats a regles deterministes
7. Connectar la decisió amb l'execució de l'oferta i les operacions del SaaS

La idea central és senzilla: quan l'elegibilitat i l'esforç de preparar una oferta estan en joc, el sistema ha de ser explicable abans de ser intel·ligent.

## El problema de producte

Un equip de contractació que revisa licitacions acostuma a plantejar-se diverses preguntes alhora:

- Aquesta oportunitat encaixa amb els nostres mercats objectiu?
- L'abast CPV és rellevant per al que venem?
- El valor del contracte justifica l'esforç?
- Hi ha exclusions dures que facin irrellevant la licitació?
- Complim requisits obligatoris com volum de negoci, mida de l'equip o certificacions?
- Qui ha de preparar la resposta real si decidim presentar-nos?

És temptador reduir totes aquestes preguntes a una única puntuació. TenderWise no ho fa.

El sistema separa deliberadament:

- **Matching de descoberta**: l'oportunitat ha d'entrar al feed?
- **Puntuació de rellevància**: és estratègicament atractiva?
- **Puntuació de qualificació**: l'empresa pot complir els criteris obligatoris coneguts?
- **Execució de l'oferta**: com prepara l'equip la resposta?

Aquesta separació és l'arquitectura.

## Normalització dels anuncis TED

TenderWise utilitza la TED Search API per descobrir oportunitats, però tracta l'XML canònic de TED com la font de veritat per als detalls.

El flux d'ingesta és:

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

Cada payload XML rep un checksum SHA-256. Si el checksum ja existeix per al número de publicació, l'anunci no ha canviat i la ingesta pot evitar el camí costós.

```python
import hashlib


def notice_checksum(xml_payload: str) -> str:
    return hashlib.sha256(xml_payload.encode("utf-8")).hexdigest()
```

Quan el checksum és nou, TenderWise desa un registre `SourceNoticeVersion` i normalitza l'XML en un o més lots. Un únic anunci TED pot descriure diversos lots, per això el model de l'aplicació està orientat a lots i no a anuncis.

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

El normalitzador prefereix text localitzat en l'idioma d'origen i aplica fallback quan falta el camp preferit. També converteix els codis de país de TED als codis de dues lletres utilitzats per la interfície i els perfils d'empresa.

Això és important perquè el codi de scoring posterior no ha de saber si un anunci feia servir `ESP`, `ES` o una ruta XML niuada. Ha de rebre un objecte d'oportunitat net.

## Extracció de requisits del text de la licitació

TenderWise extreu requisits de qualificació estructurats dels criteris de selecció TED. Alguns requisits es poden convertir en valors verificables automàticament:

- volum de negoci anual mínim
- mida mínima de l'equip
- certificacions específiques, com normes ISO
- nombre mínim de contractes comparables

El parser conserva igualment la descripció original i la ruta d'origen, perquè no tots els requisits de contractació es poden tractar de manera fiable com a dades completament estructurades.

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

La implementació real és més defensiva amb els formats decimals i les variants lingüístiques, però el principi de disseny és el mateix: extreure només allò que es pot explicar i deixar la resta com a evidència revisable.

## Matching de perfil abans de puntuar

Abans de puntuar una oportunitat, TenderWise comprova si compleix les regles dures de descoberta del perfil d'empresa.

Els perfils poden contenir:

| Camp del perfil | Funció |
| --- | --- |
| `country_codes` | Països objectiu |
| `excluded_country_codes` | Exclusions geogràfiques dures |
| `cpv_codes` | Famílies CPV objectiu |
| `excluded_cpv_codes` | Exclusions CPV dures |
| `preferred_min_value` / `preferred_max_value` | Rang de valor del contracte |
| `preferred_currency` | Moneda utilitzada per comparar valors |

La semàntica del matching és deliberadament explícita:

- OR dins d'una dimensió: qualsevol país objectiu pot coincidir.
- AND entre dimensions: les regles de país, CPV i valor han de superar-se totes.
- Les exclusions tenen prioritat sobre les inclusions.
- Els valors desconeguts continuen visibles en lloc de descartar-se silenciosament.
- Les monedes no comparables generen avisos en lloc de falsa precisió.

El matching de CPV requereix un tractament especial perquè els codis CPV són jeràrquics.

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

Un codi de perfil com `71320000` representa una família més àmplia. Un anunci amb `71321000` s'ha de continuar considerant rellevant perquè pertany a aquesta família.

La sortida del matching de descoberta no és només un booleà. TenderWise també retorna un objecte explicatiu amb països i CPV coincidents, exclusions, estat del valor i el motiu pel qual el valor del contracte s'ha pogut comparar o no.

## La rellevància és una puntuació d'encaix estratègic

Quan una oportunitat supera els filtres durs de descoberta, TenderWise en puntua la rellevància estratègica.

La rellevància no és elegibilitat. Respon a:

> Aquesta oportunitat hauria d'estar prop de la part superior del feed de l'equip?

La funció de scoring només avalua les dimensions configurades al perfil. Si una empresa no ha introduït indústries objectiu, per exemple, aquesta dimensió absent no dilueix la puntuació.

Matemàticament:

$$
\text{relevance} =
\frac{\sum_i w_i s_i}{\sum_i w_i}
$$

on cada dimensió activa té un pes $(w_i)$ i una puntuació $(s_i)$ de 0 a 100.

TenderWise utilitza dimensions com aquestes:

| Dimensió | Pes habitual | Senyal |
| --- | ---: | --- |
| Alineació CPV | 35 | coincidència exacta, de família o de família àmplia |
| Geografia | 20 | coincidència amb país objectiu |
| Valor del contracte | 15 | rang preferit i comparabilitat de moneda |
| Serveis | 20 | termes de servei presents al títol, comprador o resum |
| Indústries | 10 | termes d'indústria presents al text de l'anunci |

La implementació conserva bloquejos, avisos i punts forts juntament amb la puntuació:

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

Aquesta estructura és més útil que retornar només un número. Una puntuació de 78 amb «només alineació amb una família CPV àmplia» significa una cosa diferent d'un 78 amb coincidència CPV exacta però valor de contracte desconegut.

## La qualificació és una puntuació de preparació

La qualificació respon a una pregunta diferent:

> Aquesta empresa pot complir els requisits obligatoris coneguts?

TenderWise avalua cada requisit extret en relació amb el perfil d'empresa seleccionat.

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

Els resultats dels requisits obligatoris es tradueixen en valors de puntuació:

| Avaluació | Contribució a la puntuació |
| --- | ---: |
| `PASS` | 100 |
| `UNKNOWN` | 50 |
| `FAIL` | 0 |

Els desconeguts no es tracten deliberadament com a fallades. Que falti un camp al perfil pot significar que l'empresa no es pot qualificar, però també pot significar simplement que el sistema encara no disposa de l'evidència.

Aquesta diferència és el motiu pel qual TenderWise pot recomanar `REVIEW` en lloc de saltar directament a `NO_BID`.

## Combinació de rellevància i qualificació

TenderWise combina els dos eixos mitjançant una funció de recomanació determinista.

Els estats finals són:

- `BID`: encaix estratègic fort i evidència de qualificació suficient
- `REVIEW`: prometedora però incompleta, ambigua o per sota dels llindars automàtics de bid
- `NO_BID`: oportunitat tancada, exclusió dura, bloqueig obligatori, rellevància baixa o preparació de qualificació baixa

La lògica simplificada és aquesta:

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

Això és deliberadament menys misteriós que un model de recomanació de caixa negra.

En contractació, un `BID` automàtic incorrecte pot malgastar dies de feina. Un `NO_BID` automàtic incorrecte pot ocultar ingressos potencials. Per això les regles afavoreixen una revisió auditable quan falta evidència important.

## Per què la IA no anul·la la recomanació

TenderWise admet briefs de licitació opcionals generats amb IA, però la capa d'IA està situada després del scoring determinista.

La IA pot produir:

- un resum executiu
- punts clau
- riscos i incògnites
- passos següents suggerits
- explicacions en llenguatge natural dels requisits extrets

No pot modificar la puntuació de rellevància, la de qualificació, l'avaluació de requisits ni la recomanació.

L'entrada de la IA inclou l'avaluació determinista com a context estructurat:

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

Això manté el brief generat en el paper correcte: suport explicatiu, no autoritat de decisió.

El pipeline d'IA també utilitza un hash de contingut:

```text
prompt version
provider name
model name
tender/profile input
source notice version
profile updated timestamp
    -> SHA-256 input hash
```

Si qualsevol d'aquestes entrades canvia, els briefs en cache queden obsolets. Això evita mostrar un resum antic com si fos actual després que canviïn l'anunci, el perfil, el proveïdor o el model.

## Mantenir acotades les peticions llargues d'IA

Els anuncis TED poden ser molt extensos. Alguns contenen descripcions llargues i molts criteris de selecció. Per això TenderWise retalla l'entrada d'IA per capes en lloc d'enviar tot el registre de base de dades al proveïdor.

L'estratègia de pressupost és:

1. Començar amb un payload estructurat.
2. Retallar la descripció de la licitació si el payload és massa gran.
3. Eliminar requisits sobrants conservant-ne almenys un.
4. Escurçar descripcions de requisits i evidències.
5. Escurçar el text del perfil i les llistes llargues.
6. Fallar explícitament si el payload encara supera `AI_MAX_INPUT_CHARS`.

No és només una qüestió de cost del proveïdor. També protegeix la latència i manté les peticions del navegador responsives perquè la generació s'executa en un worker Celery, no dins de la petició HTTP.

```text
Browser clicks "Generate AI brief"
    -> API validates entitlement and queues task
    -> Celery worker builds deterministic context
    -> worker calls Ollama or OpenAI-compatible provider
    -> JSON output is validated with Pydantic
    -> result is cached against the input hash
```

## De la decisió a l'espai de treball de l'oferta

Una recomanació només és útil si modifica l'acció següent de l'equip.

TenderWise connecta cada oportunitat i perfil d'empresa amb un espai de treball de bid. Aquest espai controla:

- estat de la decisió comercial
- etapa del workflow
- termini intern
- assignacions nominatives de l'equip de bid
- checklist de tasques
- tasques creades a partir dels requisits
- comentaris
- progrés de finalització

El càlcul del progrés és petit però important:

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

És deliberadament operacional. Un equip de contractació no necessita només una puntuació; necessita una manera d'assignar feina i veure si l'oferta s'està apropant a estar llesta per presentar-se.

## Tasques en segon pla i recuperació d'errors

TenderWise utilitza Celery per a feines que no haurien de bloquejar les peticions d'usuari:

- sincronització amb TED
- reintents d'anuncis TED fallits
- tancament o neteja d'oportunitats expirades
- correus d'invitació a l'equip
- resums programats
- generació de briefs d'IA
- registre del heartbeat dels workers

Els anuncis TED fallits es persisteixen amb recompte d'intents, text de l'error, estat i pròxima hora de reintent. Els retards utilitzen backoff exponencial acotat:

```python
from datetime import timedelta


def retry_delay(attempt_count: int) -> timedelta:
    hours = min(24, 2 ** max(0, attempt_count - 1))
    return timedelta(hours=hours)
```

És un patró senzill, però canvia el perfil de fiabilitat del sistema. Un problema transitori recuperant XML s'ha de convertir en un estat de reintent observable, no en una licitació perduda.

## Límits del desplegament

En producció, TenderWise està darrere del mateix stack compartit de Nginx i Certbot que la resta de la infraestructura del meu portfoli.

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

Només el contenidor web s'uneix a la xarxa pública del proxy. PostgreSQL, Redis, FastAPI, workers, scheduler, backups i Ollama es mantenen a la xarxa Compose privada de TenderWise.

Aquesta frontera manté el desplegament avorrit en el millor sentit: l'edge públic té una responsabilitat, la xarxa de l'aplicació en té una altra i els serveis amb estat no publiquen ports del host.

## Provant les regles

Els sistemes basats en regles també necessiten tests. TenderWise té tests backend focalitzats en:

- parsing i emmagatzematge TED
- matching de perfils
- scoring de rellevància
- avaluació de qualificació
- payloads dels insights d'IA
- estat de l'espai de treball de bid
- permisos d'equip
- comportament de facturació i compte
- operacions de l'administrador de plataforma

Els tests són importants perquè els sistemes deterministes poden regressar silenciosament. Un petit canvi en la normalització CPV, el tractament de monedes o el parsing de requisits pot canviar quines licitacions apareixen al feed.

Els casos clau no són només els camins feliços. Inclouen:

- matching amb famílies CPV àmplies
- exclusions CPV que tenen prioritat
- valors de contracte desconeguts
- incompatibilitats de moneda
- falta d'evidència al perfil
- terminis expirats
- requisits obligatoris fallits
- requisits obligatoris desconeguts que han de produir `REVIEW`

## Lliçons apreses

### Separar la descoberta del scoring

Un filtre de descoberta decideix què entra al sistema. Una puntuació de rellevància ordena el que sobreviu. Barrejar-los fa més difícil explicar per què una oportunitat ha desaparegut o per què queda tan avall al rànquing.

### Mantenir la qualificació independent de la rellevància

Una licitació pot ser estratègicament perfecta però impossible de presentar per un requisit dur. També pot passar el contrari: una empresa pot qualificar per a una licitació que no val la pena perseguir.

### Evidència desconeguda no és el mateix que evidència fallida

Les decisions de contractació sovint depenen d'informació absent o ambigua. Tractar els desconeguts com a `REVIEW` manté el sistema útil sense fingir que sap més del que realment sap.

### La IA va després de l'avaluació determinista

El text d'una licitació es pot beneficiar de la resumició, però la recomanació ha de continuar sent traçable fins als camps d'origen, la configuració del perfil i les regles explícites.

### Les funcionalitats operatives formen part del producte

Els límits de facturació, logs d'auditoria, notificacions, backups i salut dels workers no són decoració. Són el que converteix una eina de suport a decisions en un SaaS viable en lloc d'un prototip.

## Pipeline final

El pipeline complet de TenderWise és aquest:

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

La principal decisió de disseny és la contenció.

TenderWise no intenta fer màgiques les decisions de contractació. Intenta fer-les estructurades, explicables, revisables i connectades amb la feina real de preparar una oferta.
