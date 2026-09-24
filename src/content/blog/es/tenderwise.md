---
title: "Construyendo TenderWise: inteligencia basada en reglas para decidir Bid/No-Bid en licitaciones europeas"
description: "Cómo diseñé TenderWise como un SaaS multilingüe de contratación pública que ingiere anuncios TED, aplica matching determinista de perfiles, separa la relevancia de la cualificación y convierte el análisis de licitaciones en preparación colaborativa de ofertas."
date: 2026-08-10
lang: es
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

El software de contratación pública tiene un modo de fallo diferente al de muchos productos de analítica.

La parte difícil no es solo encontrar oportunidades. Es ayudar a un equipo a decidir si una licitación compensa el coste de preparar una oferta, conservando a la vez suficiente evidencia para que la decisión pueda revisarse más adelante.

Ese es el problema detrás de **TenderWise**, un SaaS multilingüe para la contratación pública europea. Ingiere anuncios TED, los normaliza en oportunidades estructuradas, los filtra según perfiles de empresa, separa la relevancia estratégica de la preparación para cumplir los requisitos y convierte la decisión final en un espacio de trabajo colaborativo para preparar la oferta.

Este artículo recorre el diseño técnico:

1. Normalizar anuncios TED en oportunidades
2. Comparar perfiles de empresa con países, códigos CPV y valores de contrato
3. Puntuar la relevancia mediante dimensiones ponderadas activas
4. Evaluar requisitos obligatorios de cualificación
5. Producir recomendaciones `BID`, `REVIEW` y `NO_BID`
6. Mantener los resúmenes de IA subordinados a reglas deterministas
7. Conectar la decisión con la ejecución de la oferta y las operaciones SaaS

La idea central es sencilla: cuando están en juego la elegibilidad y el esfuerzo de preparar una oferta, el sistema debe ser explicable antes que inteligente.

## El problema de producto

Un equipo de contratación que revisa licitaciones suele plantearse varias preguntas a la vez:

- ¿Esta oportunidad encaja con nuestros mercados objetivo?
- ¿El ámbito CPV es relevante para lo que vendemos?
- ¿El valor del contrato justifica el esfuerzo?
- ¿Existen exclusiones duras que hagan irrelevante la licitación?
- ¿Cumplimos requisitos obligatorios como facturación, tamaño del equipo o certificaciones?
- ¿Quién debe preparar la respuesta real si decidimos presentarnos?

Es tentador reducir todas esas preguntas a una sola puntuación. TenderWise no lo hace.

El sistema separa deliberadamente:

- **Matching de descubrimiento**: ¿debe entrar la oportunidad en el feed?
- **Puntuación de relevancia**: ¿es estratégicamente atractiva?
- **Puntuación de cualificación**: ¿puede la empresa cumplir los criterios obligatorios conocidos?
- **Ejecución de la oferta**: ¿cómo prepara el equipo la respuesta?

Esa separación es la arquitectura.

## Normalización de anuncios TED

TenderWise utiliza la TED Search API para descubrir oportunidades, pero trata el XML canónico de TED como fuente de verdad para sus detalles.

El flujo de ingesta es:

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

Cada payload XML recibe un checksum SHA-256. Si el checksum ya existe para el número de publicación, el anuncio no ha cambiado y la ingesta puede omitir el camino costoso.

```python
import hashlib


def notice_checksum(xml_payload: str) -> str:
    return hashlib.sha256(xml_payload.encode("utf-8")).hexdigest()
```

Cuando el checksum es nuevo, TenderWise guarda un registro `SourceNoticeVersion` y normaliza el XML en uno o varios lotes. Un único anuncio TED puede describir varios lotes, por lo que el modelo de la aplicación está orientado a lotes y no a anuncios.

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

El normalizador prefiere texto localizado en el idioma de origen y aplica fallback cuando falta el campo preferido. También convierte los códigos de país de TED a los códigos de dos letras usados por la interfaz y los perfiles de empresa.

Esto importa porque el código de scoring posterior no debería saber si un anuncio utilizó `ESP`, `ES` o una ruta XML anidada. Debe recibir un objeto de oportunidad limpio.

## Extracción de requisitos del texto de la licitación

TenderWise extrae requisitos estructurados de cualificación de los criterios de selección TED. Algunos requisitos pueden convertirse en valores verificables automáticamente:

- facturación anual mínima
- tamaño mínimo del equipo
- certificaciones concretas, como normas ISO
- número mínimo de contratos comparables

El parser conserva también la descripción original y la ruta de origen, porque no todos los requisitos de contratación pueden considerarse de forma fiable datos totalmente estructurados.

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

La implementación real es más defensiva con los formatos decimales y las variantes lingüísticas, pero el principio de diseño es el mismo: extraer solo aquello que puede explicarse y dejar el resto como evidencia revisable.

## Matching del perfil antes de puntuar

Antes de puntuar una oportunidad, TenderWise comprueba si satisface las reglas duras de descubrimiento del perfil de empresa.

Los perfiles pueden contener:

| Campo del perfil | Función |
| --- | --- |
| `country_codes` | Países objetivo |
| `excluded_country_codes` | Exclusiones geográficas duras |
| `cpv_codes` | Familias CPV objetivo |
| `excluded_cpv_codes` | Exclusiones CPV duras |
| `preferred_min_value` / `preferred_max_value` | Rango de valor del contrato |
| `preferred_currency` | Moneda usada para comparar valores |

La semántica del matching es deliberadamente explícita:

- OR dentro de una dimensión: cualquier país objetivo puede coincidir.
- AND entre dimensiones: las reglas de país, CPV y valor deben superarse todas.
- Las exclusiones prevalecen sobre las inclusiones.
- Los valores desconocidos siguen visibles en vez de descartarse silenciosamente.
- Las monedas no comparables generan avisos en lugar de falsa precisión.

El matching de CPV requiere un tratamiento especial porque los códigos CPV son jerárquicos.

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

Un código de perfil como `71320000` representa una familia más amplia. Un anuncio con `71321000` debe seguir considerándose relevante porque pertenece a esa familia.

La salida del matching de descubrimiento no es solo un booleano. TenderWise devuelve también un objeto explicativo con países y CPV coincidentes, exclusiones, estado del valor y el motivo por el que el valor del contrato pudo o no compararse.

## La relevancia es una puntuación de encaje estratégico

Cuando una oportunidad supera los filtros duros de descubrimiento, TenderWise puntúa su relevancia estratégica.

La relevancia no es elegibilidad. Responde a:

> ¿Debería esta oportunidad estar cerca de la parte superior del feed del equipo?

La función de scoring solo evalúa las dimensiones configuradas en el perfil. Si una empresa no ha introducido industrias objetivo, por ejemplo, esa dimensión ausente no diluye la puntuación.

Matemáticamente:

$$
\text{relevance} =
\frac{\sum_i w_i s_i}{\sum_i w_i}
$$

donde cada dimensión activa tiene un peso $(w_i)$ y una puntuación $(s_i)$ de 0 a 100.

TenderWise utiliza dimensiones como:

| Dimensión | Peso habitual | Señal |
| --- | ---: | --- |
| Alineación CPV | 35 | coincidencia exacta, de familia o de familia amplia |
| Geografía | 20 | coincidencia con país objetivo |
| Valor del contrato | 15 | rango preferido y comparabilidad de moneda |
| Servicios | 20 | términos de servicio presentes en título, comprador o resumen |
| Industrias | 10 | términos de industria presentes en el texto del anuncio |

La implementación conserva bloqueos, avisos y puntos fuertes junto a la puntuación:

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

Esa estructura es más útil que devolver un número aislado. Una puntuación de 78 con «solo alineación con una familia CPV amplia» significa algo distinto de un 78 con coincidencia CPV exacta pero valor de contrato desconocido.

## La cualificación es una puntuación de preparación

La cualificación responde a otra pregunta:

> ¿Puede esta empresa cumplir los requisitos obligatorios conocidos?

TenderWise evalúa cada requisito extraído frente al perfil de empresa seleccionado.

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

Los resultados de los requisitos obligatorios se traducen en valores de puntuación:

| Evaluación | Contribución a la puntuación |
| --- | ---: |
| `PASS` | 100 |
| `UNKNOWN` | 50 |
| `FAIL` | 0 |

Los desconocidos no se tratan deliberadamente como fallos. Que falte un campo en un perfil puede significar que la empresa no puede cualificar, pero también que el sistema aún no dispone de la evidencia.

Esa diferencia es la razón por la que TenderWise puede recomendar `REVIEW` en lugar de saltar directamente a `NO_BID`.

## Combinación de relevancia y cualificación

TenderWise combina ambos ejes mediante una función de recomendación determinista.

Los estados finales son:

- `BID`: encaje estratégico fuerte y evidencia de cualificación suficiente
- `REVIEW`: prometedora pero incompleta, ambigua o por debajo de los umbrales automáticos de bid
- `NO_BID`: oportunidad cerrada, exclusión dura, bloqueo obligatorio, baja relevancia o baja preparación de cualificación

La lógica simplificada es:

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

Esto es deliberadamente menos misterioso que un modelo de recomendación de caja negra.

En contratación, un `BID` automático incorrecto puede desperdiciar días de trabajo. Un `NO_BID` automático incorrecto puede ocultar ingresos. Por eso las reglas favorecen una revisión auditable cuando falta evidencia importante.

## Por qué la IA no anula la recomendación

TenderWise admite briefs de licitación opcionales generados con IA, pero la capa de IA está situada después del scoring determinista.

La IA puede producir:

- un resumen ejecutivo
- puntos clave
- riesgos e incógnitas
- siguientes pasos sugeridos
- explicaciones en lenguaje natural de los requisitos extraídos

No puede modificar la puntuación de relevancia, la de cualificación, la evaluación de requisitos ni la recomendación.

La entrada de IA incluye la evaluación determinista como contexto estructurado:

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

Esto mantiene el brief generado en su papel correcto: apoyo explicativo, no autoridad de decisión.

El pipeline de IA también utiliza un hash de contenido:

```text
prompt version
provider name
model name
tender/profile input
source notice version
profile updated timestamp
    -> SHA-256 input hash
```

Si cualquiera de esas entradas cambia, los briefs cacheados quedan obsoletos. Esto evita mostrar un resumen antiguo como actual después de que cambien el anuncio, el perfil, el proveedor o el modelo.

## Mantener acotadas las peticiones largas de IA

Los anuncios TED pueden ser muy extensos. Algunos contienen descripciones largas y muchos criterios de selección. TenderWise recorta la entrada de IA por capas en vez de enviar todo el registro de base de datos al proveedor.

La estrategia de presupuesto es:

1. Empezar con un payload estructurado.
2. Recortar la descripción de la licitación si el payload es demasiado grande.
3. Eliminar requisitos sobrantes conservando al menos uno.
4. Acortar las descripciones de requisitos y evidencias.
5. Acortar el texto del perfil y los campos de listas largas.
6. Fallar explícitamente si el payload todavía supera `AI_MAX_INPUT_CHARS`.

No se trata solo del coste del proveedor. También protege la latencia y mantiene responsivas las peticiones del navegador porque la generación ocurre en un worker Celery, no dentro de la petición HTTP.

```text
Browser clicks "Generate AI brief"
    -> API validates entitlement and queues task
    -> Celery worker builds deterministic context
    -> worker calls Ollama or OpenAI-compatible provider
    -> JSON output is validated with Pydantic
    -> result is cached against the input hash
```

## De la decisión al espacio de trabajo de la oferta

Una recomendación solo es útil si cambia la siguiente acción del equipo.

TenderWise conecta cada oportunidad y perfil de empresa con un espacio de trabajo de bid. El espacio controla:

- estado de decisión comercial
- etapa del workflow
- plazo interno
- asignaciones nominativas del equipo de bid
- checklist de tareas
- tareas creadas a partir de requisitos
- comentarios
- progreso de finalización

El cálculo de progreso es pequeño pero importante:

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

Es deliberadamente operacional. Un equipo de contratación no necesita solo una puntuación; necesita una forma de asignar trabajo y comprobar si la oferta está acercándose a estar lista para presentar.

## Tareas en segundo plano y recuperación de errores

TenderWise utiliza Celery para trabajo que no debería bloquear las peticiones de usuario:

- sincronización TED
- reintentos de anuncios TED fallidos
- cierre o limpieza de oportunidades expiradas
- correo de invitación al equipo
- resúmenes programados
- generación de briefs de IA
- registro del heartbeat de los workers

Los anuncios TED fallidos se persisten con número de intentos, texto del error, estado y siguiente hora de reintento. Los retrasos usan backoff exponencial acotado:

```python
from datetime import timedelta


def retry_delay(attempt_count: int) -> timedelta:
    hours = min(24, 2 ** max(0, attempt_count - 1))
    return timedelta(hours=hours)
```

Es un patrón sencillo, pero cambia el perfil de fiabilidad del sistema. Un problema transitorio recuperando XML debe convertirse en un estado de reintento observable, no en una licitación perdida.

## Límites del despliegue

En producción, TenderWise está detrás del mismo stack compartido de Nginx y Certbot que el resto de la infraestructura de mi portfolio.

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

Solo el contenedor web se une a la red pública del proxy. PostgreSQL, Redis, FastAPI, workers, scheduler, backups y Ollama permanecen en la red Compose privada de TenderWise.

Esa frontera mantiene el despliegue aburrido en el mejor sentido: el edge público tiene un trabajo, la red de aplicación tiene otro y los servicios con estado no publican puertos del host.

## Probando las reglas

Los sistemas basados en reglas también necesitan tests. TenderWise tiene tests backend focalizados en:

- parsing y almacenamiento TED
- matching de perfiles
- scoring de relevancia
- evaluación de cualificación
- payloads de insights de IA
- estado del espacio de trabajo de bid
- permisos de equipo
- comportamiento de facturación y cuenta
- operaciones del administrador de plataforma

Los tests importan porque los sistemas deterministas pueden sufrir regresiones silenciosas. Un pequeño cambio en normalización CPV, tratamiento de monedas o parsing de requisitos puede cambiar qué licitaciones aparecen en un feed.

Los casos clave no son solo los caminos felices. Incluyen:

- matching con familias CPV amplias
- exclusiones CPV que prevalecen
- valores de contrato desconocidos
- incompatibilidades de moneda
- falta de evidencia en el perfil
- plazos expirados
- requisitos obligatorios fallidos
- requisitos obligatorios desconocidos que deben producir `REVIEW`

## Lecciones aprendidas

### Separar el descubrimiento del scoring

Un filtro de descubrimiento decide qué entra en el sistema. Una puntuación de relevancia ordena lo que sobrevive. Mezclarlos hace más difícil explicar por qué una oportunidad desapareció o por qué está tan abajo en el ranking.

### Mantener la cualificación independiente de la relevancia

Una licitación puede ser estratégicamente perfecta pero imposible de presentar por un requisito duro. También puede ocurrir lo contrario: una empresa puede cualificar para una licitación que no merece la pena perseguir.

### Evidencia desconocida no es lo mismo que evidencia fallida

Las decisiones de contratación a menudo dependen de información ausente o ambigua. Tratar los desconocidos como `REVIEW` mantiene el sistema útil sin fingir que sabe más de lo que realmente sabe.

### La IA va después de la evaluación determinista

El texto de una licitación puede beneficiarse del resumen, pero la recomendación debe seguir siendo trazable hasta los campos de origen, la configuración del perfil y las reglas explícitas.

### Las funcionalidades operativas forman parte del producto

Los límites de facturación, logs de auditoría, notificaciones, backups y salud de los workers no son decoración. Son lo que hace viable una herramienta de apoyo a decisiones como SaaS en lugar de como prototipo.

## Pipeline final

El pipeline completo de TenderWise es:

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

La principal decisión de diseño es la contención.

TenderWise no intenta convertir las decisiones de contratación en algo mágico. Intenta hacerlas estructuradas, explicables, revisables y conectadas con el trabajo real de preparar una oferta.
