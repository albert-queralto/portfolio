---
title: "Operar PostgreSQL, Redis y Celery en un VPS de 8 GB"
description: "Qué me ha enseñado ejecutar PostgreSQL, Redis, workers de Celery y varias aplicaciones SaaS en un VPS de 8 GB sobre presupuestos de recursos, concurrencia, colas y simplicidad operativa."
date: 2026-09-05
lang: es
translationKey: operating-postgresql-redis-celery-8gb-vps
tags: ["DevOps", "PostgreSQL", "Redis", "Celery", "Docker", "Production"]
draft: false
cover: "/og/operating-postgresql-redis-celery-8gb-vps.png"
featured: false
---

Ejecutar una aplicación de machine learning en producción suele implicar mucho más que servir un modelo.

Mis aplicaciones utilizan PostgreSQL para el estado persistente, Redis para la coordinación, Celery para el trabajo asíncrono, FastAPI para las API, React para las interfaces de usuario y Docker para empaquetar los servicios. TenderWise también ejecuta ingestión programada de datos de contratación pública y cargas opcionales de IA. Payrithm añade procesamiento asíncrono alrededor de facturas, flujos de predicción y operaciones de cobro.

La restricción interesante es que no ejecuto estos sistemas en un gran clúster de Kubernetes.

Los ejecuto en un VPS relativamente pequeño con **8 GB de RAM y 80 GB de almacenamiento**.

Esa restricción ha sido útil. Me obliga a pensar en el consumo de recursos en lugar de ocultar la ineficiencia detrás de una máquina más grande.

La lección central ha sido sencilla:

> En un servidor pequeño, la planificación de capacidad forma parte de la arquitectura de la aplicación.

## La arquitectura

En el extremo público utilizo una configuración compartida de Nginx y Certbot.

Conceptualmente, el servidor tiene este aspecto:

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
            +-- tareas de backup
```

El reverse proxy público sabe cómo enrutar los dominios. Las bases de datos de las aplicaciones no necesitan hacerlo.

Solo los servicios que necesitan tráfico externo se unen a la red pública del proxy. PostgreSQL, Redis y los workers en segundo plano permanecen en redes privadas de Docker.

Eso me da una frontera útil tanto de seguridad como operativa: una base de datos no necesita un puerto expuesto en el host simplemente porque la aplicación que la utiliza sea pública.

## Ocho gigabytes no son ocho gigabytes para Celery

Un error habitual al dimensionar workers en segundo plano es mirar la máquina y pensar:

```text
8 GB de RAM
por tanto
hay espacio de sobra para workers
```

Pero el pool de workers es solo uno de los consumidores.

La memoria también es necesaria para:

- el sistema operativo,
- Docker,
- PostgreSQL,
- Redis,
- procesos FastAPI,
- contenedores de frontend,
- Nginx,
- tareas programadas,
- backups,
- y la caché del sistema de archivos.

Si además se está ejecutando un modelo local de IA opcional, el cálculo cambia todavía más drásticamente.

Por tanto, la pregunta correcta no es:

> ¿Cuántos workers de Celery puedo iniciar?

Es:

> ¿Cuánta memoria y CPU puede consumir el procesamiento en segundo plano sin degradar la aplicación interactiva?

Esa distinción importa.

## PostgreSQL también necesita un presupuesto de conexiones

La concurrencia de Celery no solo consume CPU y memoria. También puede multiplicar las conexiones a la base de datos.

Imaginemos un servicio de API con su propio pool de conexiones de SQLAlchemy y varios procesos de Celery que pueden abrir conexiones a la base de datos de forma independiente.

Aumentar la concurrencia de los workers de cuatro a ocho puede potencialmente duplicar el número de consumidores simultáneos de la base de datos.

Si varias aplicaciones comparten el mismo servidor, esta multiplicación ocurre de forma independiente en cada stack.

Por eso, cuando cambio la concurrencia de Celery también pienso en:

```text
procesos de worker
×
posibles conexiones DB por proceso
+
pools de conexiones de la API
+
conexiones administrativas/en segundo plano
```

PostgreSQL es extremadamente fiable, pero abrir un número arbitrario de conexiones no es gratis.

En una máquina pequeña, pools deliberadamente modestos suelen ser mejores que valores por defecto grandes.

## Redis debe coordinar el trabajo, no convertirse en el trabajo

Redis es ligero en comparación con muchos otros servicios, pero es fácil olvidar que el estado de las colas también consume memoria.

Si los productores pueden añadir trabajos a la cola más rápido de lo que los workers pueden procesarlos, la cola se convierte en un sistema de almacenamiento de trabajo sin terminar.

Normalmente eso indica que hay algún otro problema.

Una arquitectura asíncrona saludable necesita alguna forma de backpressure.

Por ejemplo, una tarea programada de ingestión no debería crear continuamente miles de tareas duplicadas porque el ciclo anterior todavía no ha terminado.

Prefiero tareas programadas idempotentes y un estado de cola observable.

En TenderWise, los anuncios de contratación que han fallado también tienen estado persistente de reintento en PostgreSQL. Eso significa que Redis no necesita convertirse en el registro duradero de qué falló y por qué.

La base de datos puede conservar campos como:

```text
anuncio
número de intentos
último error
estado
próximo momento de reintento
```

Celery es responsable de ejecutar el reintento.

Esa separación hace que la recuperación sea mucho más fácil de razonar.

## No todas las tareas en segundo plano son iguales

Una de las razones por las que la capacidad de Celery se complica es que las duraciones de las tareas pueden ser radicalmente distintas.

TenderWise utiliza procesamiento asíncrono para trabajos como:

- sincronización de TED,
- reintentos de anuncios fallidos,
- mantenimiento de oportunidades caducadas,
- envío de correo electrónico,
- resúmenes programados,
- resúmenes de licitaciones con IA,
- y registro de salud de los workers.

Una tarea de correo electrónico y una tarea de generación con IA no deberían tratarse como cargas equivalentes.

Del mismo modo, descargar y analizar un anuncio de contratación grande puede ocupar un worker durante mucho más tiempo que actualizar un heartbeat.

Un modelo mental útil es:

```text
CORTAS
correo electrónico
notificaciones
actualizaciones pequeñas

MEDIAS
normalización
scoring
limpieza programada

LARGAS
ingestión masiva
entrenamiento de modelos
generación con IA
```

Una vez clasificadas las cargas de esta manera, la capacidad de los workers resulta más fácil de diseñar.

Entonces puede introducirse separación de colas cuando sea necesario:

```text
Redis
 |
 +-- default ------> workers generales
 |
 +-- ingestion ----> workers de ingestión
 |
 +-- ml/ai --------> workers costosos
```

La topología exacta depende de la carga de trabajo. Lo importante es que una tarea de larga duración no debería impedir innecesariamente que se ejecute una tarea corta y visible para el usuario.

## Aumentar la concurrencia puede hacer que el sistema sea más lento

La respuesta más evidente a la saturación de workers es simplemente:

> Añadir más workers.

A veces es correcto.

Pero aumentar la concurrencia también puede crear:

- más contención de CPU,
- más conexiones a la base de datos,
- más peticiones de red simultáneas,
- más presión de memoria,
- y más cambios de contexto.

Por tanto, un pool de workers es una decisión de asignación de recursos, no un regulador de velocidad.

El experimento que me interesa no es solo:

```text
tareas / segundo
```

Es:

```text
throughput en segundo plano
mientras
la latencia de la API se mantiene aceptable
y
la memoria se mantiene estable
```

Esas restricciones deben medirse conjuntamente.

> **Medición que añadir antes de publicar:** comparar la concurrencia de los workers, el tiempo de espera en cola, la latencia p95 de la API y el uso de RAM para al menos dos configuraciones.

## Vigilar la edad de la cola, no solo la CPU

El uso de CPU me dice si la máquina está ocupada.

No me dice si los usuarios están esperando a que se ejecute un trabajo.

En sistemas asíncronos me importan:

- profundidad de la cola,
- edad de la tarea más antigua en cola,
- tiempo de ejecución de las tareas,
- tasa de fallos de las tareas,
- heartbeat de los workers,
- y número de reintentos.

Una cola con 200 tareas puede estar bien si cada una tarda 20 milisegundos.

Cinco tareas en cola pueden ser un problema si cada una necesita diez minutos.

La edad de la tarea sin terminar más antigua suele ser más útil que la longitud bruta de la cola.

## El disco forma parte del modelo de capacidad

El VPS también tiene un disco finito de 80 GB.

Las bases de datos crecen. Las imágenes de Docker se acumulan. Los logs crecen. Los backups crecen. Las capas de build antiguas siguen ocupando espacio si no se limpian.

Por tanto, producción requiere controles poco llamativos pero necesarios:

```text
rotación de logs
retención de backups
limpieza de imágenes Docker
monitorización de la base de datos
alertas de uso de disco
```

Una máquina con RAM disponible todavía puede fallar de forma espectacular si PostgreSQL se encuentra con un sistema de archivos lleno.

## Qué he aprendido

El servidor ha cambiado la forma en que pienso sobre la arquitectura de producción.

Ya no trato PostgreSQL, Redis y Celery como tecnologías independientes.

Forman un sistema de recursos.

Aumentar una parte modifica la presión sobre las demás.

Más concurrencia de Celery puede significar más conexiones a PostgreSQL. Una ingestión más rápida puede significar colas más grandes y un crecimiento más rápido de la base de datos. Más logging puede mejorar el debugging al mismo tiempo que consume disco.

Por tanto, el objetivo no es la utilización máxima.

Es una utilización predecible.

Para sistemas de producción pequeños, a menudo es un objetivo de ingeniería mejor que intentar reproducir la arquitectura de una empresa que opera cientos de servidores.

Un VPS modesto puede ejecutar aplicaciones sorprendentemente capaces.

Pero solo si cada servicio recuerda que comparte la máquina.
