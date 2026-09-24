---
title: "Qué salió mal al ingerir datos de contratación pública de TED"
description: "Los problemas de modelo de datos y fiabilidad que dieron forma al pipeline de ingestión TED de TenderWise, desde versiones de avisos y lotes hasta campos multilingües, reintentos y criterios de cualificación semiestructurados."
date: 2026-10-01
publishAt: 2026-10-01T08:00:00+02:00
lang: es
translationKey: ted-procurement-data-ingestion-lessons
tags: ["Data Engineering", "ETL", "PostgreSQL", "Celery", "Procurement", "SaaS"]
draft: false
cover: "/og/ted-procurement-data-ingestion-lessons.png"
featured: false
project: "tenderwise"
---

Cuando empecé a construir **TenderWise**, ingerir avisos europeos de contratación pública parecía la parte fácil.

Buscar en TED, recuperar un aviso, parsear algunos campos y guardarlos en PostgreSQL.

Después, puntuar la oportunidad.

Cuanto más trabajaba con los datos de origen, más evidente se hacía que la capa de ingestión no era un simple detalle de fontanería.

Formaba parte del modelo de decisión del producto.

Si la fuente se interpreta de forma incorrecta, todo lo que viene después puede estar equivocado con una confianza aparente muy alta.

Estos son los modos de fallo que cambiaron la arquitectura.

## Problema 1: un resultado de búsqueda no es la fuente de verdad

TenderWise utiliza la TED Search API para descubrir avisos.

Pero los datos de descubrimiento no bastan para la evaluación completa.

Por eso trato el XML canónico de TED como la fuente autoritativa para los detalles de la oportunidad.

El pipeline pasó a ser:

```text
TED Search API
    |
número de publicación
    |
    v
XML canónico
    |
    v
checksum
    |
    v
versión de la fuente
    |
    v
normalización
    |
    v
oportunidad
```

La distinción importa porque TenderWise necesita más que un título y una fecha límite.

Necesita evidencia de origen para elementos como:

- códigos CPV,
- países,
- valor del contrato,
- lotes,
- criterios de selección,
- y requisitos de cualificación.

## Problema 2: los avisos cambian

Un aviso de contratación pública no es necesariamente inmutable.

Las correcciones y versiones posteriores pueden modificar detalles útiles.

Sobrescribir simplemente la fila anterior de la base de datos destruiría el historial que explica por qué cambió una recomendación.

Por eso TenderWise calcula un checksum SHA-256 del contenido canónico de la fuente.

Conceptualmente:

```python
checksum = sha256(xml_payload.encode("utf-8")).hexdigest()
```

Si el checksum ya existe para el número de publicación, la ruta de ingestión puede evitar reprocesamiento innecesario.

Si es diferente, la aplicación puede almacenar una nueva versión de la fuente.

Eso da procedencia al sistema:

```text
recomendación
    |
basada en
    |
estado de la oportunidad
    |
derivado de
    |
versión concreta del aviso fuente
```

Esto se vuelve especialmente importante cuando un usuario pregunta por qué la evaluación de ayer es diferente de la de hoy.

## Problema 3: un aviso puede contener múltiples oportunidades

Mi primer modelo mental estaba demasiado centrado en el aviso.

Un aviso TED puede describir varios lotes.

Esos lotes pueden diferir en alcance, valor, geografía o requisitos.

Por tanto, tratar todo el aviso como una sola oportunidad puede combinar hechos que deberían permanecer separados.

El modelo interno de TenderWise pasó a orientarse a los lotes.

Un lote normalizado contiene campos como:

```text
ID del lote
título
descripción
comprador
países
códigos CPV
valor estimado
moneda
fecha límite
idioma de origen
requisitos
```

La unidad de ingestión deja de ser:

> He descargado un aviso.

Y pasa a ser:

> He producido una o más oportunidades comerciales normalizadas a partir de un aviso versionado.

## Problema 4: la geografía no es un único código limpio

La interfaz y los perfiles de empresa no deberían necesitar entender todas las representaciones utilizadas por un dataset upstream.

La lógica posterior no debería preocuparse de si una fuente usa una representación de código de país mientras la aplicación espera otra.

Esa conversión pertenece a la normalización.

Parece trivial, pero los errores de normalización son especialmente peligrosos porque producen desajustes silenciosos.

Una empresa puede configurar España como país objetivo y, aun así, perder oportunidades españolas si las dos capas no coinciden en la representación del país.

La misma regla general se aplica más allá de la geografía:

> La variabilidad externa debe detenerse en la frontera de ingestión.

## Problema 5: los códigos CPV son jerárquicos

El matching de CPV también es más sutil que una igualdad.

Una empresa interesada en una familia de servicios más amplia no debería necesariamente perder un aviso solo porque el aviso utiliza un código descendiente más específico.

Por eso TenderWise normaliza los valores CPV y permite matching significativo por prefijo de familia.

La implicación práctica es que una familia configurada más amplia puede coincidir con una clasificación más específica del aviso dentro de esa familia.

El matching por cadena exacta produciría falsos negativos.

Hacer matching ingenuamente con todos los prefijos, por otro lado, produciría demasiados falsos positivos.

La jerarquía del dominio pertenece a la lógica de matching.

## Problema 6: el texto multilingüe necesita reglas de fallback deterministas

TED es multilingüe.

Un campo que quiero en un idioma puede faltar mientras existe otra representación localizada.

Eso significa que la normalización necesita una estrategia explícita de preferencia y fallback.

La parte importante no es intentar una traducción mágica durante la ingestión.

Es asegurarse de que la capa de scoring recibe un campo predecible.

Quiero que el código posterior consuma:

```python
opportunity.title
```

en lugar de tener que entender todas las rutas XML y alternativas de idioma que lo produjeron.

## Problema 7: los criterios de cualificación solo están parcialmente estructurados

Parte de la información comercialmente más importante de una licitación aparece en criterios de selección expresados en lenguaje natural.

Algunos ejemplos son:

- facturación anual mínima,
- tamaño mínimo del equipo,
- certificación ISO,
- y número de contratos comparables.

Algunos pueden convertirse de forma segura en requisitos estructurados.

Otros no.

El enfoque peligroso sería forzar cada frase a convertirse en un valor estructurado.

TenderWise, en cambio, conserva la descripción original y la ruta de origen y, cuando la confianza es suficiente, también crea un requisito estructurado.

Cuando una regla no puede extraerse de forma fiable, se convierte en evidencia para revisión manual.

Esto es deliberadamente menos ambicioso que fingir que el parser lo entiende todo.

## Problema 8: desconocido no significa cero

La información ausente crea otro problema sutil de ingestión.

Supongamos que falta el valor del contrato.

Eso no significa:

```text
valor del contrato = 0
```

Del mismo modo, un criterio de cualificación que no puede parsearse no significa que la empresa lo incumpla.

TenderWise conserva estados desconocidos y advertencias.

Esto importa en las decisiones posteriores porque:

```text
FAIL
```

y:

```text
UNKNOWN
```

conducen a decisiones de contratación pública muy diferentes.

## Problema 9: los fallos transitorios no pueden hacer desaparecer licitaciones

Las peticiones de red fallan. Los endpoints XML externos fallan. Aparecen documentos inesperados. Existen bugs de parsing.

Un sistema de ingestión de producción no puede omitir esos registros silenciosamente.

TenderWise persiste el estado de ingestión fallida con información como:

```text
número de intentos
error
estado
próxima hora de reintento
```

Los reintentos usan backoff exponencial acotado en lugar de golpear repetidamente un sistema upstream que ya está fallando.

Conceptualmente:

```text
intento 1 -> 1 hora
intento 2 -> 2 horas
intento 3 -> 4 horas
...
limitado a un intervalo máximo
```

Esto da a los fallos un ciclo de vida visible.

Una descarga rota se convierte en un objeto operativo que puede inspeccionarse y reintentarse, en lugar de una licitación desaparecida que nadie sabe que existía.

## Problema 10: la idempotencia importa

La sincronización programada volverá a visitar repetidamente el mismo universo de contratación pública.

Eso significa que el pipeline tiene que tolerar la repetición.

Ejecutar la ingestión dos veces no debería crear dos copias del mismo lote.

Reprocesar XML idéntico no debería crear versiones artificiales.

Reintentar después de un crash del worker no debería dejar registros contradictorios.

Por tanto, los checksums, los identificadores de origen estables y los upserts de base de datos no son detalles de optimización.

Son mecanismos de corrección.

## Qué cambió en mi forma de pensar

Al principio pensaba que la parte interesante de TenderWise empezaría después de la ingestión:

```text
matching
scoring
BID / REVIEW / NO_BID
```

En realidad, la calidad de esas decisiones depende mucho de lo que ocurre antes.

El sistema de ingestión determina:

- qué es una oportunidad,
- qué versión de la fuente representa,
- qué datos son conocidos,
- qué datos son desconocidos,
- y si un fallo sigue siendo recuperable.

Por tanto, la arquitectura final es mucho más explícita:

```text
TED Search
    -> recuperación de la fuente canónica
    -> detección de versiones
    -> normalización de lotes
    -> extracción de requisitos
    -> oportunidad persistente
    -> matching de descubrimiento
    -> relevancia
    -> cualificación
```

Esta arquitectura es menos cómoda que guardar directamente una respuesta de búsqueda en una base de datos.

También es mucho más fácil confiar en ella.

La principal lección que saqué de la ingestión TED es que no se debería permitir que los datos externos filtren sus inconsistencias al resto de la aplicación.

La normalización es donde la incertidumbre se hace explícita.

Y en un sistema de apoyo a decisiones, la incertidumbre explícita es mucho más segura que la precisión falsa.
