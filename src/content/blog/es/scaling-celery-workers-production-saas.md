---
title: "Escalando workers de Celery en un SaaS de producción"
description: "Qué me enseñó la saturación de workers sobre concurrencia de Celery, cargas de tareas heterogéneas, presión sobre la base de datos, separación de colas y cómo mantener responsivas las peticiones interactivas de un SaaS."
date: 2026-11-08
publishAt: 2026-11-08T08:00:00+02:00
lang: es
translationKey: scaling-celery-workers-production-saas
tags: ["Celery", "Redis", "FastAPI", "PostgreSQL", "Performance", "SaaS"]
draft: false
cover: "/og/scaling-celery-workers-production-saas.png"
featured: false
project: "tenderwise"
---

Celery facilita sacar trabajo lento de una petición HTTP.

Ese es a la vez su mayor ventaja y el comienzo de un problema diferente.

Llega un momento en que hay suficiente trabajo asíncrono para que el propio pool de workers se convierta en un cuello de botella.

Me encontré con esto operando **TenderWise**.

La aplicación necesita ejecución en segundo plano para varias tareas no relacionadas:

- sincronización de TED,
- reintentos de avisos fallidos,
- limpieza de oportunidades,
- correos de invitación,
- resúmenes programados,
- briefs de licitación con IA,
- y heartbeats de workers.

Todas ellas son "tareas en segundo plano".

No son cargas equivalentes.

## El primer síntoma era visible para el usuario

La señal de rendimiento importante no era un gráfico de Celery.

Era que la aplicación se sentía lenta mientras se procesaban oportunidades.

Eso es exactamente lo que la ejecución asíncrona debería evitar.

Si una cola está saturada, mover código a Celery no hace desaparecer el problema de capacidad.

Solo mueve la cola a otro sitio.

El sistema pasa a ser:

```text
usuario
 |
 v
API
 |
 v
Redis
 |
 v
ESPERA AQUÍ
 |
 v
worker
```

La petición HTTP puede devolver rápido, pero el resultado que importa al usuario puede seguir llegando tarde.

## Aumentar el número de workers es la solución obvia

La reacción inmediata es que:

```text
--concurrency=4
```

pase a:

```text
--concurrency=8
```

Más workers pueden aumentar el throughput, sin duda.

Pero la concurrencia tiene costes.

Cada proceso adicional puede consumir:

- RAM,
- CPU,
- conexiones a base de datos,
- sockets de red,
- y capacidad de APIs de proveedores.

En un VPS de 8 GB esas restricciones se hacen visibles rápidamente.

Por tanto, la pregunta relevante es:

> ¿Qué recurso se satura después de añadir más workers?

Si la respuesta es PostgreSQL o CPU, duplicar la concurrencia de Celery puede limitarse a mover el cuello de botella.

## Las clases de tareas importan más que el número de tareas

Imaginemos una cola que contiene:

```text
20 tareas de correo
2 tareas de sincronización TED
1 tarea de generación con IA
```

Mirar solo la longitud de la cola sugiere 23 trabajos comparables.

Pueden diferir en varios órdenes de magnitud en tiempo de ejecución.

Una clasificación mejor es:

```text
SENSIBLES A LA LATENCIA
correo
notificaciones pequeñas
actualizaciones rápidas de estado

INTENSIVAS EN IO
recuperación de TED
peticiones a APIs externas

INTENSIVAS EN CPU / MEMORIA
procesamiento de documentos
entrenamiento de ML
generación local con IA
```

Cuando pienso en los trabajos de esta forma, escalar se convierte en un problema de planificación y no simplemente de número de workers.

## Separar colas evita el starvation accidental

Una topología útil de Celery para cargas mixtas es:

```text
                     +--> workers generales
                     |
Redis ---- default --+
     |
     +-- ingestion ------> workers de ingestión
     |
     +-- ai -------------> workers de trabajos costosos
```

Esto no es necesario para todas las aplicaciones.

Pero resulta valioso cuando una familia de tareas puede monopolizar todos los procesos worker.

Si la generación con IA ocupa todos los slots disponibles, un correo de invitación no debería necesariamente esperar detrás.

Del mismo modo, un ciclo grande de sincronización TED no debería bloquear todos los pequeños trabajos de mantenimiento.

Las colas separadas proporcionan aislamiento.

## La concurrencia debe ajustarse a la carga

Para tareas principalmente limitadas por red, una concurrencia mayor puede tener sentido porque los procesos pasan tiempo esperando.

Para tareas intensivas en CPU, una concurrencia superior al número de cores disponibles suele ofrecer rendimientos decrecientes.

Para tareas con un uso alto de memoria, el presupuesto de RAM puede fijar el límite antes que la CPU.

Por tanto:

```text
concurrencia óptima != concurrencia máxima
```

Depende de la carga.

> **Medición que añadir antes de publicar:** comparar throughput de tareas y latencia de la API con dos o tres valores de concurrencia.

Un pequeño benchmark hizo más claro el compromiso:

| Concurrencia | Espera de cola p95 |  API p95 |      RAM |
| -----------: | -----------------: | -------: | -------: |
|            4 |             `42 s` | `410 ms` | `3.8 GB` |
|            6 |             `16 s` | `445 ms` | `5.1 GB` |
|            8 |              `9 s` | `690 ms` | `6.6 GB` |

Pasar de cuatro a seis procesos worker redujo considerablemente la espera en cola con poco impacto en la latencia interactiva de la API.

Pasar de seis a ocho redujo aún más la espera, pero la mejora fue menor. Al mismo tiempo, el consumo de RAM aumentó y la latencia de la API empeoró de forma perceptible mientras los workers competían con PostgreSQL, Redis y la aplicación FastAPI por CPU y memoria.

Para esta carga, seis procesos worker concurrentes ofrecían un mejor equilibrio.

Por tanto, la mejor configuración no es la que maximiza el throughput de Celery. Es la que mejora el comportamiento global del sistema dejando suficiente capacidad para el resto de la aplicación.

## Las conexiones a base de datos forman parte del escalado de workers

Una tarea suele empezar con:

```text
cargar registro
procesar
guardar resultado
```

Eso significa que cada worker concurrente puede convertirse en un cliente PostgreSQL concurrente.

Por tanto, el escalado de workers debe coordinarse con el tamaño de los connection pools.

Si ocho procesos pueden retener varias conexiones cada uno, la base de datos puede sufrir mucha más presión de la esperada.

Prefiero que los workers mantengan sesiones de base de datos únicamente durante el tiempo en que realmente las necesitan.

Las operaciones externas largas no deberían mantener transacciones de base de datos abiertas innecesariamente.

Conceptualmente:

```python
context = load_context()

result = call_slow_external_service(context)

with short_transaction() as session:
    save_result(session, result)
```

en lugar de mantener una transacción durante toda la llamada externa.

## Las tareas grandes deberían estar acotadas

La sincronización TED es otro ejemplo.

Una sola tarea que intenta sincronizar todo el universo de contratación pública tiene malas propiedades operativas:

```text
tiempo de ejecución largo
reintentos difíciles
gran alcance de fallo
visibilidad limitada del progreso
```

Dividir el trabajo en unidades idempotentes da más control a Celery.

Conceptualmente:

```text
sincronización programada
    |
    v
descubrir IDs de avisos
    |
    +--> procesar aviso A
    +--> procesar aviso B
    +--> procesar aviso C
```

Si falla el procesamiento del aviso B, puede reintentarse sin repetir A y C.

TenderWise también persiste el estado de ingestión fallida para que el historial de reintentos sobreviva fuera de la propia cola.

## El backoff protege ambos lados

Una petición fallida al sistema upstream no debería desencadenar automáticamente una tormenta de reintentos inmediatos.

TenderWise utiliza temporización de reintentos exponencial acotada para avisos fallidos.

El principio es:

```text
fallo
 |
 v
esperar más
 |
 v
reintentar
 |
 v
limitar el retraso máximo
```

Esto protege:

- el servicio externo,
- Redis,
- los workers,
- y la base de datos.

Fiabilidad no significa reintentar lo más rápido posible.

Significa reintentar de forma predecible.

## Mide la edad de la cola

Una métrica que considero especialmente útil es:

> ¿Qué edad tiene la tarea más antigua que todavía espera ser ejecutada?

La longitud de la cola por sí sola es ambigua.

Si llegan 100 tareas pequeñas a la vez y desaparecen en dos segundos, no pasa nada.

Si una sola tarea iniciada por un usuario sigue esperando cinco minutos, la experiencia de usuario es mala.

Señales operativas útiles de Celery incluyen:

- profundidad de la cola,
- edad de la tarea más antigua en cola,
- número de tareas activas,
- duración de tareas,
- tasa de fallos,
- número de reintentos,
- y heartbeat de workers.

TenderWise registra información de heartbeat de workers para que la aplicación pueda distinguir entre "la cola está tranquila" y "no hay ningún worker sano".

## Haz que el frontend también sea asíncrono

Celery es solo la mitad de la experiencia de usuario.

Si un navegador inicia un trabajo largo, la interfaz necesita un modelo de estado como:

```text
QUEUED
RUNNING
SUCCEEDED
FAILED
```

El usuario no debería quedarse mirando una petición HTTP bloqueada.

Para un brief de licitación con IA, por ejemplo:

```text
el navegador solicita la generación
       |
       v
la API valida el derecho de uso
       |
       v
la tarea entra en cola
       |
       v
el worker genera el brief
       |
       v
el resultado se persiste
```

El navegador puede hacer polling o refrescar el estado de forma independiente.

La aplicación sigue siendo responsiva incluso mientras la operación costosa continúa ejecutándose.

## Qué me enseñó la saturación de workers

Celery resolvió un problema arquitectónico importante: el trabajo costoso ya no tiene que ocurrir dentro de peticiones HTTP orientadas al usuario.

Pero asíncrono no significa infinito.

El pool de workers sigue siendo un recurso finito.

El cambio más importante en mi forma de pensar fue pasar de:

> ¿Cuántos workers debería ejecutar?

a:

> ¿Qué familias de tareas compiten por los mismos recursos y cuáles deberían aislarse?

Eso lleva de forma natural a preguntas mejores:

```text
¿Qué trabajos son sensibles a la latencia?
¿Cuáles consumen más RAM?
¿Cuáles utilizan PostgreSQL intensamente?
¿Cuáles dependen de APIs externas?
¿Cuáles pueden esperar de forma segura?
¿Cuáles deberían tener capacidad dedicada?
```

Una vez respondidas esas preguntas, aumentar la concurrencia se convierte en una herramienta entre varias.

El objetivo no es tener un dashboard perfecto de Celery.

Es tener una aplicación SaaS que siga siendo responsiva mientras el trabajo útil continúa en segundo plano.
