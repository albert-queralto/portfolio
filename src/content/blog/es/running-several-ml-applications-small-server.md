---
title: "Cómo ejecuto varias aplicaciones de ML en un único servidor pequeño"
description: "Cómo utilizo Docker, redes privadas de aplicación y un único punto de entrada Nginx para operar varios proyectos de ML y SaaS en un VPS de 8 GB sin convertirlo en un mini clúster de Kubernetes."
date: 2026-12-22
publishAt: 2026-12-22T08:00:00+02:00
lang: es
translationKey: running-several-ml-applications-small-server
tags:
  ["DevOps", "Docker", "Nginx", "Machine Learning", "SaaS", "Infrastructure"]
draft: false
cover: "/og/running-several-ml-applications-small-server.png"
featured: false
---

Mi portfolio parece una colección de aplicaciones independientes.

Operativamente, varias comparten una misma restricción física:

el mismo servidor.

La máquina tiene **8 GB de RAM y 80 GB de disco**.

Tiene que servir el portfolio y, al mismo tiempo, dar soporte a aplicaciones como Payrithm y TenderWise, incluyendo APIs, bases de datos PostgreSQL, colas Redis, workers de Celery y tareas programadas.

Podría resolverlo dando a cada proyecto un entorno cloud independiente.

A mi escala actual, eso añadiría coste y complejidad operativa más rápido de lo que añadiría valor.

En su lugar, utilizo una arquitectura deliberadamente sencilla.

## Un único punto de entrada público

El servidor expone un reverse proxy Nginx compartido.

Conceptualmente:

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

Nginx gestiona:

- TLS,
- enrutado por host,
- headers de proxy,
- configuración HTTP,
- y puntos de entrada públicos.

Cada aplicación no necesita resolver el TLS público por separado.

Eso también me da un lugar evidente donde inspeccionar el tráfico entrante y la configuración de certificados.

## Cada aplicación sigue siendo su propio stack

Compartir un servidor no significa ejecutar todo dentro de un único archivo Docker Compose gigante.

Prefiero que cada aplicación sea propietaria de sus servicios.

Por ejemplo:

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

mientras Payrithm puede evolucionar de forma independiente con su propio stack.

Esto conserva una propiedad importante:

> Puedo desplegar una aplicación sin, conceptualmente, desplegar el servidor.

El edge compartido es infraestructura.

El proyecto Compose de la aplicación es el producto.

## Solo el servicio público se une a la red del proxy

Para TenderWise, únicamente el contenedor orientado a la web necesita comunicarse con el edge público Nginx.

Internamente:

```text
red pública del proxy
        |
        v
TenderWise web
        |
        v
red privada de TenderWise
        |
        +-- API
        +-- PostgreSQL
        +-- Redis
        +-- Celery
        +-- scheduler
        +-- backups
```

PostgreSQL no necesita publicar un puerto público del host.

Redis tampoco.

Los workers tampoco.

El mismo patrón se aplica a otras aplicaciones.

Esto reduce drásticamente el número de servicios expuestos por el host.

## Los contenedores son aislamiento, no magia

Docker facilita separar dependencias de aplicaciones.

No crea RAM adicional.

Todos los contenedores siguen compartiendo la misma máquina física.

Eso significa que tengo que pensar globalmente en:

```text
CPU
memoria
disco
red
```

aunque el despliegue esté separado por proyecto.

Esto se vuelve especialmente visible con los workers en segundo plano.

Payrithm y TenderWise pueden estar perfectamente configurados individualmente y aun así competir por la misma CPU física.

Por tanto, la planificación de capacidad existe en dos niveles:

```text
dentro de cada aplicación
y
en el conjunto del host
```

## Los servicios con estado necesitan un tratamiento especial

Los contenedores frontend y API sin estado son relativamente fáciles de recrear.

PostgreSQL es diferente.

Los contenedores de aplicación pueden desaparecer.

Los volúmenes de base de datos no pueden desaparecer con la misma ligereza.

Por eso trato:

- los volúmenes de base de datos,
- los archivos de backup,
- y los datos subidos o persistentes

como infraestructura que merece un ciclo de vida explícito.

Los backups también introducen otro problema en un servidor pequeño: el uso de disco.

Si conservo cada backup para siempre, una estrategia de backup que funciona acaba convirtiéndose en una estrategia de agotamiento de disco.

La retención importa.

## Las imágenes Docker también consumen los 80 GB de disco

Los despliegues frecuentes dejan capas atrás.

Con el tiempo el host puede acumular:

```text
imágenes antiguas
build cache sin utilizar
contenedores detenidos
logs de aplicación
backups de base de datos
crecimiento de la base de datos
```

Por tanto, monitorizar el disco es tan importante como monitorizar la CPU.

Un servicio puede tener RAM disponible y fallar igualmente porque PostgreSQL no puede ampliar un archivo en un disco lleno.

El mantenimiento necesita tareas poco glamurosas como:

```text
rotar logs
expirar backups antiguos
eliminar imágenes Docker sin utilizar
monitorizar el crecimiento de volúmenes
```

Esas tareas no son espectaculares.

Son ingeniería de producción.

## Prefiero redes privadas explícitas

Varios proyectos Compose crean oportunidades de acoplamiento accidental.

Un servicio de Payrithm no debería poder dirigirse a la base de datos de TenderWise simplemente porque ambos sean contenedores Docker.

Las redes privadas por aplicación proporcionan una frontera útil por defecto.

La arquitectura pasa a ser:

```text
                 red compartida del proxy
                 /                     \
                /                       \
        Payrithm web              TenderWise web
             |                          |
       red privada                  red privada
             |                          |
      servicios internos          servicios internos
```

La infraestructura compartida es explícita.

Todo lo demás queda aislado por defecto.

## El procesamiento en segundo plano es el recurso compartido más difícil

Las páginas estáticas son baratas.

Las peticiones HTTP suelen ser cortas.

Las cargas en segundo plano pueden ocupar recursos durante mucho más tiempo.

Algunos ejemplos son:

- sincronización de contratación pública,
- procesamiento de documentos,
- entrenamiento de ML,
- generación con IA,
- y analítica programada.

Esto hace que los workers sean el área donde voy con más cuidado con los presupuestos de recursos.

Si varias aplicaciones deciden realizar trabajo costoso en segundo plano al mismo tiempo, ninguna cantidad de aislamiento Docker cambia el hecho de que comparten CPU y RAM.

Por eso me importan:

- la concurrencia de Celery,
- la profundidad de las colas,
- la programación de tareas,
- la salud de los workers,
- y los pools de conexiones a base de datos

a nivel del host.

## La programación puede reducir la contención

No todos los trabajos necesitan ejecutarse inmediatamente.

El mantenimiento programado, los backups y la ingestión a veces pueden distribuirse entre distintas ventanas temporales.

Por ejemplo, no necesito que todos los backups de base de datos y todos los schedulers de ingestión se despierten exactamente en el mismo minuto.

Escalonar cargas recurrentes es una forma sencilla de gestión de capacidad.

En un clúster grande apenas podría importar.

En un host de 8 GB, sí.

## La observabilidad no necesita empezar con una plataforma enorme

Mi objetivo actual no es reproducir el stack de observabilidad de una empresa de hiperescala.

Necesito suficiente visibilidad para responder preguntas prácticas:

```text
¿El servidor se está quedando sin memoria?
¿El disco se está llenando?
¿PostgreSQL está sano?
¿Redis es accesible?
¿Los workers de Celery están vivos?
¿Está creciendo una cola?
¿Las peticiones HTTP se están volviendo lentas?
¿Ha fallado una tarea programada?
```

Los endpoints de salud a nivel de aplicación, los heartbeats de workers, los logs de Docker y las métricas del host pueden responder muchas de estas preguntas.

El stack de observabilidad debería ser proporcional al sistema.

## ¿Cuándo debería crecer el servidor?

Ejecutar varias aplicaciones en un único host no es una ideología arquitectónica permanente.

Es una decisión de coste y complejidad.

Me plantearía separar cargas cuando señales como estas se volvieran persistentes:

```text
presión de memoria pese a la optimización
contención de CPU que afecta al tráfico interactivo
carga de base de datos que requiere escalado independiente
cargas de IA dominando la capacidad del host
requisitos de disponibilidad distintos
gran crecimiento de clientes o datos
mantenimiento de una aplicación afectando a otra
```

En ese punto la arquitectura puede evolucionar.

Por ejemplo:

```text
servidor compartido
      |
      +--> base de datos dedicada
      |
      +--> máquina dedicada para workers
      |
      +--> hosts de aplicación separados
```

Las fronteras Docker existentes facilitan esa migración porque las aplicaciones ya se comunican mediante interfaces de servicio.

## Una infraestructura pequeña sigue siendo infraestructura real

Operar en un único VPS a veces se descarta como "no producción" en comparación con un clúster cloud.

Creo que eso pasa por alto el problema de ingeniería interesante.

El servidor sigue necesitando:

```text
TLS
aislamiento de red
almacenamiento persistente
backups
procesamiento en segundo plano
bases de datos
despliegue
monitorización
recuperación ante fallos
gestión de recursos
```

La escala es menor.

Las responsabilidades son reales.

De hecho, la restricción hace visibles los errores arquitectónicos rápidamente.

Un pool de workers mal acotado consume toda la RAM disponible.

Un pool de base de datos sin límites crea presión de conexiones.

Imágenes Docker olvidadas llenan el disco.

Una instancia Redis expuesta públicamente crea un riesgo de seguridad innecesario.

Hay poca capacidad sobrante para ocultar esas decisiones.

## La arquitectura que quiero es aburrida

El objetivo final no es demostrar cuántas tecnologías de infraestructura puedo operar.

Es:

```text
git push / deploy
       |
       v
la aplicación arranca
       |
       v
Nginx enruta el tráfico
       |
       v
los servicios privados se comunican
       |
       v
se ejecutan las tareas en segundo plano
       |
       v
el estado tiene backup
```

Cuando algo falla, quiero saber qué frontera es responsable del problema.

Un servidor pequeño recompensa esa simplicidad.

Ejecutar varias aplicaciones de ML con 8 GB es posible no porque la máquina sea extraordinariamente potente, sino porque la arquitectura evita fingir que cada proyecto necesita infraestructura de hiperescala.

Para la escala a la que estoy construyendo ahora, ese compromiso me aporta algo más valioso que una plataforma complicada:

un entorno de producción que entiendo de extremo a extremo.
