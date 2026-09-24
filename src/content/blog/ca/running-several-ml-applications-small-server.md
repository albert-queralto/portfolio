---
title: "Com executo diverses aplicacions de ML en un únic servidor petit"
description: "Com utilitzo Docker, xarxes privades d'aplicació i un únic punt d'entrada Nginx per operar diversos projectes de ML i SaaS en un VPS de 8 GB sense convertir-lo en un mini clúster de Kubernetes."
date: 2026-12-22
publishAt: 2026-12-22T08:00:00+02:00
lang: ca
translationKey: running-several-ml-applications-small-server
tags:
  ["DevOps", "Docker", "Nginx", "Machine Learning", "SaaS", "Infrastructure"]
draft: false
cover: "/og/running-several-ml-applications-small-server.png"
featured: false
---

El meu portfoli sembla una col·lecció d'aplicacions independents.

Operativament, diverses comparteixen una mateixa restricció física:

el mateix servidor.

La màquina té **8 GB de RAM i 80 GB de disc**.

Ha de servir el portfoli i, alhora, donar suport a aplicacions com Payrithm i TenderWise, incloent APIs, bases de dades PostgreSQL, cues Redis, workers de Celery i tasques programades.

Podria resoldre-ho donant a cada projecte un entorn cloud independent.

A la meva escala actual, això afegiria cost i complexitat operativa més ràpidament que no pas valor.

En lloc d'això, utilitzo una arquitectura deliberadament simple.

## Un únic punt d'entrada públic

El servidor exposa un reverse proxy Nginx compartit.

Conceptualment:

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
- encaminament per host,
- headers de proxy,
- configuració HTTP,
- i punts d'entrada públics.

Cada aplicació no necessita resoldre el TLS públic pel seu compte.

Això també em dona un lloc evident on inspeccionar el trànsit entrant i la configuració dels certificats.

## Cada aplicació continua sent el seu propi stack

Compartir servidor no significa executar-ho tot dins d'un únic fitxer Docker Compose gegant.

Prefereixo que cada aplicació sigui propietària dels seus serveis.

Per exemple:

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

mentre que Payrithm pot evolucionar independentment amb el seu propi stack.

Això conserva una propietat important:

> Puc desplegar una aplicació sense, conceptualment, desplegar el servidor.

L'edge compartit és infraestructura.

El projecte Compose de l'aplicació és el producte.

## Només el servei públic entra a la xarxa del proxy

Per a TenderWise, només el contenidor orientat al web necessita comunicar-se amb l'edge públic Nginx.

Internament:

```text
xarxa pública del proxy
        |
        v
TenderWise web
        |
        v
xarxa privada de TenderWise
        |
        +-- API
        +-- PostgreSQL
        +-- Redis
        +-- Celery
        +-- scheduler
        +-- backups
```

PostgreSQL no necessita exposar un port públic de l'host.

Redis tampoc.

Els workers tampoc.

El mateix patró s'aplica a altres aplicacions.

Això redueix dràsticament el nombre de serveis exposats per l'host.

## Els contenidors són aïllament, no màgia

Docker facilita separar dependències d'aplicació.

No crea RAM addicional.

Tots els contenidors continuen compartint la mateixa màquina física.

Això significa que he de pensar globalment en:

```text
CPU
memòria
disc
xarxa
```

encara que el desplegament estigui separat per projecte.

Això es fa especialment visible amb els workers en segon pla.

Payrithm i TenderWise poden estar perfectament configurats individualment i, tot i així, competir per la mateixa CPU física.

Per tant, la planificació de capacitat existeix en dos nivells:

```text
dins de cada aplicació
i
a escala de tot l'host
```

## Els serveis amb estat necessiten un tractament especial

Els contenidors frontend i API sense estat són relativament fàcils de recrear.

PostgreSQL és diferent.

Els contenidors d'aplicació poden desaparèixer.

Els volums de base de dades no poden desaparèixer amb la mateixa lleugeresa.

Per això tracto:

- els volums de base de dades,
- els fitxers de backup,
- i les dades pujades o persistents

com a infraestructura que mereix un cicle de vida explícit.

Els backups també introdueixen un altre problema en un servidor petit: l'ús de disc.

Si conservo cada backup per sempre, una estratègia de backup que funciona acaba convertint-se en una estratègia d'esgotament de disc.

La retenció importa.

## Les imatges Docker també consumeixen els 80 GB de disc

Els desplegaments freqüents deixen capes enrere.

Amb el temps l'host pot acumular:

```text
imatges antigues
build cache no utilitzada
contenidors aturats
logs d'aplicació
backups de base de dades
creixement de la base de dades
```

Per tant, monitorar el disc és tan important com monitorar la CPU.

Un servei pot tenir RAM disponible i fallar igualment perquè PostgreSQL no pot ampliar un fitxer en un disc ple.

El manteniment necessita tasques poc glamuroses com:

```text
rotar logs
expirar backups antics
eliminar imatges Docker no utilitzades
monitorar el creixement dels volums
```

Aquestes tasques no són espectaculars.

Són enginyeria de producció.

## Prefereixo xarxes privades explícites

Múltiples projectes Compose creen oportunitats d'acoblament accidental.

Un servei de Payrithm no hauria de poder adreçar-se a la base de dades de TenderWise simplement perquè tots dos són contenidors Docker.

Les xarxes privades per aplicació ofereixen una bona frontera per defecte.

L'arquitectura passa a ser:

```text
                 xarxa compartida del proxy
                 /                       \
                /                         \
        Payrithm web                TenderWise web
             |                            |
      xarxa privada                 xarxa privada
             |                            |
      serveis interns               serveis interns
```

La infraestructura compartida és explícita.

Tota la resta queda aïllada per defecte.

## El processament en segon pla és el recurs compartit més difícil

Les pàgines estàtiques són barates.

Les peticions HTTP solen ser curtes.

Les càrregues en segon pla poden ocupar recursos durant molt més temps.

Alguns exemples són:

- sincronització de contractació pública,
- processament de documents,
- entrenament de ML,
- generació amb IA,
- i analítica programada.

Això fa que els workers siguin l'àrea on vaig amb més cura amb els pressupostos de recursos.

Si diverses aplicacions decideixen executar feina costosa en segon pla al mateix temps, cap quantitat d'aïllament Docker canvia el fet que comparteixen CPU i RAM.

Per això m'importen:

- la concurrència de Celery,
- la profunditat de les cues,
- la programació de tasques,
- la salut dels workers,
- i els pools de connexions a base de dades

a escala de l'host.

## La programació pot reduir la competència pels recursos

No totes les tasques s'han d'executar immediatament.

El manteniment programat, els backups i la ingestió de vegades es poden repartir en finestres temporals diferents.

Per exemple, no necessito que tots els backups de base de dades i tots els schedulers d'ingestió es despertin exactament al mateix minut.

Desfasar càrregues recurrents és una forma simple de gestió de capacitat.

En un clúster gran potser gairebé no importaria.

En un host de 8 GB, sí.

## L'observabilitat no ha de començar amb una plataforma gegant

El meu objectiu actual no és reproduir l'stack d'observabilitat d'una empresa d'hiperescala.

Necessito prou visibilitat per respondre preguntes pràctiques:

```text
El servidor s'està quedant sense memòria?
El disc s'està omplint?
PostgreSQL està sa?
Redis és accessible?
Els workers de Celery estan vius?
Una cua està creixent?
Les peticions HTTP s'estan alentint?
Ha fallat una tasca programada?
```

Els endpoints de salut a nivell d'aplicació, els heartbeats dels workers, els logs de Docker i les mètriques de l'host poden respondre moltes d'aquestes preguntes.

L'stack d'observabilitat ha de ser proporcional al sistema.

## Quan hauria de créixer el servidor?

Executar diverses aplicacions en un sol host no és una ideologia arquitectònica permanent.

És una decisió de cost i complexitat.

Em plantejaria separar càrregues quan senyals com aquests es tornessin persistents:

```text
pressió de memòria malgrat l'optimització
contenció de CPU que afecta el trànsit interactiu
càrrega de base de dades que necessita escalar independentment
càrregues d'IA dominant la capacitat de l'host
requisits de disponibilitat diferents
gran creixement de clients o dades
manteniment d'una aplicació afectant-ne una altra
```

En aquest punt, l'arquitectura pot evolucionar.

Per exemple:

```text
servidor compartit
      |
      +--> base de dades dedicada
      |
      +--> màquina dedicada per a workers
      |
      +--> hosts d'aplicació separats
```

Les fronteres Docker existents faciliten aquesta migració perquè les aplicacions ja es comuniquen mitjançant interfícies de servei.

## Una infraestructura petita continua sent infraestructura real

Operar en un únic VPS de vegades es descarta com a "no producció" en comparació amb un clúster cloud.

Crec que això passa per alt el problema d'enginyeria interessant.

El servidor continua necessitant:

```text
TLS
aïllament de xarxa
emmagatzematge persistent
backups
processament en segon pla
bases de dades
desplegament
monitoratge
recuperació de fallades
gestió de recursos
```

L'escala és més petita.

Les responsabilitats són reals.

De fet, la restricció fa visibles els errors arquitectònics ràpidament.

Un pool de workers mal acotat consumeix tota la RAM disponible.

Un pool de base de dades sense límits crea pressió de connexions.

Imatges Docker oblidades omplen el disc.

Una instància Redis exposada públicament crea un risc de seguretat innecessari.

Hi ha poca capacitat sobrera per amagar aquestes decisions.

## L'arquitectura que vull és avorrida

L'objectiu final no és demostrar quantes tecnologies d'infraestructura puc operar.

És:

```text
git push / deploy
       |
       v
l'aplicació arrenca
       |
       v
Nginx encamina el trànsit
       |
       v
els serveis privats es comuniquen
       |
       v
s'executen les tasques en segon pla
       |
       v
l'estat té backup
```

Quan alguna cosa falla, vull saber quina frontera és propietària del problema.

Un servidor petit recompensa aquesta simplicitat.

Executar diverses aplicacions de ML amb 8 GB és possible no perquè la màquina sigui excepcionalment potent, sinó perquè l'arquitectura evita fingir que cada projecte necessita infraestructura d'hiperescala.

Per a l'escala en què estic construint ara, aquest compromís em dona una cosa més valuosa que una plataforma complicada:

un entorn de producció que entenc de punta a punta.
