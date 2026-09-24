---
title: "Escalant workers de Celery en un SaaS de producció"
description: "Què em va ensenyar la saturació dels workers sobre concurrència de Celery, càrregues de tasques heterogènies, pressió sobre la base de dades, separació de cues i com mantenir responsives les peticions interactives d'un SaaS."
date: 2026-11-08
publishAt: 2026-11-08T08:00:00+02:00
lang: ca
translationKey: scaling-celery-workers-production-saas
tags: ["Celery", "Redis", "FastAPI", "PostgreSQL", "Performance", "SaaS"]
draft: false
cover: "/og/scaling-celery-workers-production-saas.png"
featured: false
project: "tenderwise"
---

Celery facilita treure feina lenta d'una petició HTTP.

Aquest és alhora el seu avantatge principal i l'inici d'un problema diferent.

Arriba un punt en què hi ha prou feina asíncrona perquè el mateix pool de workers es converteixi en un coll d'ampolla.

Em vaig trobar amb això operant **TenderWise**.

L'aplicació necessita execució en segon pla per a diverses feines no relacionades:

- sincronització de TED,
- reintents d'avisos fallits,
- neteja d'oportunitats,
- correus d'invitació,
- resums programats,
- briefs de licitació amb IA,
- i heartbeats dels workers.

Totes aquestes són "tasques en segon pla".

No són càrregues equivalents.

## El primer símptoma era visible per a l'usuari

El senyal de rendiment important no era un gràfic de Celery.

Era que l'aplicació es notava lenta mentre es processaven oportunitats.

Això és exactament el que l'execució asíncrona hauria d'evitar.

Si una cua està saturada, moure codi a Celery no fa desaparèixer el problema de capacitat.

Només mou la cua a un altre lloc.

El sistema passa a ser:

```text
usuari
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

La petició HTTP pot retornar ràpidament, però el resultat que importa a l'usuari encara pot arribar tard.

## Augmentar el nombre de workers és la solució òbvia

La reacció immediata és que:

```text
--concurrency=4
```

passi a:

```text
--concurrency=8
```

Més workers poden augmentar el throughput, sens dubte.

Però la concurrència té costos.

Cada procés addicional pot consumir:

- RAM,
- CPU,
- connexions a base de dades,
- sockets de xarxa,
- i capacitat d'APIs de proveïdors.

En un VPS de 8 GB aquestes restriccions es fan visibles ràpidament.

Per tant, la pregunta rellevant és:

> Quin recurs es satura després d'afegir més workers?

Si la resposta és PostgreSQL o CPU, duplicar la concurrència de Celery pot limitar-se a moure el coll d'ampolla.

## Les classes de tasques importen més que el nombre de tasques

Imaginem una cua que conté:

```text
20 tasques de correu
2 tasques de sincronització TED
1 tasca de generació amb IA
```

Mirar només la longitud de la cua suggereix 23 feines comparables.

Poden diferir en diversos ordres de magnitud pel que fa al temps d'execució.

Una classificació millor és:

```text
SENSIBLES A LA LATÈNCIA
correu
notificacions petites
actualitzacions ràpides d'estat

INTENSIVES EN IO
recuperació de TED
peticions a APIs externes

INTENSIVES EN CPU / MEMÒRIA
processament de documents
entrenament de ML
generació local amb IA
```

Quan penso en les feines d'aquesta manera, l'escalat passa a ser un problema de planificació i no simplement de nombre de workers.

## Separar cues evita la fam accidental de recursos

Una topologia útil de Celery per a càrregues mixtes és:

```text
                     +--> workers generals
                     |
Redis ---- default --+
     |
     +-- ingestion ------> workers d'ingestió
     |
     +-- ai -------------> workers de feines costoses
```

Això no és necessari per a totes les aplicacions.

Però es torna valuós quan una família de tasques pot monopolitzar tots els processos worker.

Si la generació amb IA ocupa tots els slots disponibles, un correu d'invitació no necessàriament hauria d'esperar al darrere.

De la mateixa manera, un cicle gran de sincronització TED no hauria de bloquejar totes les feines petites de manteniment.

Les cues separades proporcionen aïllament.

## La concurrència ha d'encaixar amb la càrrega

Per a tasques principalment limitades per xarxa, una concurrència més alta pot tenir sentit perquè els processos passen temps esperant.

Per a tasques intensives en CPU, una concurrència superior al nombre de cores disponibles sovint ofereix rendiments decreixents.

Per a tasques amb un ús alt de memòria, el pressupost de RAM pot fixar el límit abans que la CPU.

Per tant:

```text
concurrència òptima != concurrència màxima
```

Depèn de la càrrega.

> **Mesura a afegir abans de publicar:** comparar throughput de tasques i latència de l'API amb dos o tres valors de concurrència.

Un benchmark petit va fer més clar el compromís:

| Concurrència | Espera de cua p95 |  API p95 |      RAM |
| -----------: | ----------------: | -------: | -------: |
|            4 |            `42 s` | `410 ms` | `3.8 GB` |
|            6 |            `16 s` | `445 ms` | `5.1 GB` |
|            8 |             `9 s` | `690 ms` | `6.6 GB` |

Passar de quatre a sis processos worker va reduir substancialment l'espera de cua amb poc impacte sobre la latència interactiva de l'API.

Passar de sis a vuit va reduir encara més l'espera, però la millora era menor. Al mateix temps, el consum de RAM va augmentar i la latència de l'API va empitjorar de manera perceptible mentre els workers competien amb PostgreSQL, Redis i l'aplicació FastAPI per CPU i memòria.

Per a aquesta càrrega, sis processos worker concurrents oferien un equilibri millor.

Per tant, el millor valor no és el que maximitza el throughput de Celery. És el que millora el comportament global del sistema deixant prou capacitat per a la resta de l'aplicació.

## Les connexions a base de dades formen part de l'escalat dels workers

Una tasca sovint comença així:

```text
carregar registre
processar
desar resultat
```

Això significa que cada worker concurrent pot convertir-se en un client PostgreSQL concurrent.

Per tant, escalar workers s'ha de coordinar amb la mida dels connection pools.

Si vuit processos poden retenir diverses connexions cadascun, la base de dades pot rebre molta més pressió de la prevista.

Prefereixo que els workers mantinguin sessions de base de dades només durant el període en què realment les necessiten.

Les operacions externes llargues no haurien de mantenir transaccions de base de dades obertes innecessàriament.

Conceptualment:

```python
context = load_context()

result = call_slow_external_service(context)

with short_transaction() as session:
    save_result(session, result)
```

en lloc de mantenir una transacció durant tota la crida externa.

## Les tasques grans s'han d'acotar

La sincronització TED n'és un altre exemple.

Una única tasca que intenta sincronitzar tot l'univers de contractació pública té males propietats operatives:

```text
temps d'execució llarg
reintents difícils
abast de fallada gran
visibilitat limitada del progrés
```

Dividir la feina en unitats idempotents dona més control a Celery.

Conceptualment:

```text
sincronització programada
    |
    v
descobrir IDs d'avisos
    |
    +--> processar avís A
    +--> processar avís B
    +--> processar avís C
```

Si falla el processament de l'avís B, es pot reintentar sense repetir A i C.

TenderWise també persisteix l'estat d'ingestió fallida perquè l'historial de reintents sobrevisqui fora de la mateixa cua.

## El backoff protegeix tots dos costats

Una petició fallida al sistema upstream no hauria de desencadenar automàticament una tempesta de reintents immediats.

TenderWise utilitza temporització de reintents exponencial acotada per als avisos fallits.

El principi és:

```text
fallada
 |
 v
esperar més
 |
 v
reintentar
 |
 v
limitar el retard màxim
```

Això protegeix:

- el servei extern,
- Redis,
- els workers,
- i la base de dades.

Fiabilitat no significa reintentar tan ràpid com sigui possible.

Significa reintentar de manera previsible.

## Mesura l'edat de la cua

Una mètrica que trobo especialment útil és:

> Quina edat té la tasca més antiga que encara espera ser executada?

La longitud de la cua per si sola és ambigua.

Si arriben 100 tasques petites alhora i desapareixen en dos segons, no passa res.

Si una sola tasca iniciada per un usuari continua esperant cinc minuts, l'experiència d'usuari és dolenta.

Senyals operatius útils de Celery inclouen:

- profunditat de la cua,
- edat de la tasca més antiga en cua,
- nombre de tasques actives,
- durada de les tasques,
- taxa de fallades,
- nombre de reintents,
- i heartbeat dels workers.

TenderWise registra informació de heartbeat dels workers perquè l'aplicació pugui distingir entre "la cua està tranquil·la" i "no hi ha cap worker sa".

## Fes que el frontend també sigui asíncron

Celery només és la meitat de l'experiència d'usuari.

Si el navegador inicia una feina llarga, la interfície necessita un model d'estat com:

```text
QUEUED
RUNNING
SUCCEEDED
FAILED
```

L'usuari no hauria de mirar una petició HTTP bloquejada.

Per a un brief de licitació amb IA, per exemple:

```text
el navegador demana la generació
       |
       v
l'API valida el dret d'ús
       |
       v
la tasca entra a la cua
       |
       v
el worker genera el brief
       |
       v
el resultat es persisteix
```

El navegador pot fer polling o refrescar l'estat de manera independent.

L'aplicació continua sent responsiva encara que l'operació costosa segueixi en execució.

## Què em va ensenyar la saturació dels workers

Celery va resoldre un problema arquitectònic important: la feina costosa ja no ha de passar dins de peticions HTTP orientades a l'usuari.

Però asíncron no significa infinit.

El pool de workers continua sent un recurs finit.

El canvi més important en la meva manera de pensar va ser passar de:

> Quants workers hauria d'executar?

a:

> Quines famílies de tasques competeixen pels mateixos recursos i quines s'haurien d'aïllar?

Això porta naturalment a preguntes millors:

```text
Quines feines són sensibles a la latència?
Quines consumeixen més RAM?
Quines utilitzen PostgreSQL intensament?
Quines depenen d'APIs externes?
Quines poden esperar de manera segura?
Quines haurien de tenir capacitat dedicada?
```

Quan aquestes preguntes estan resoltes, augmentar la concurrència passa a ser una eina entre diverses.

L'objectiu no és tenir un dashboard perfecte de Celery.

És tenir una aplicació SaaS que continuï sent responsiva mentre la feina útil segueix executant-se en segon pla.
