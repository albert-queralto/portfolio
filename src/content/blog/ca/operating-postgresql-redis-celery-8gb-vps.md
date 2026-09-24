---
title: "Operar PostgreSQL, Redis i Celery en un VPS de 8 GB"
description: "Què m'ha ensenyat executar PostgreSQL, Redis, workers de Celery i diverses aplicacions SaaS en un VPS de 8 GB sobre pressupostos de recursos, concurrència, cues i simplicitat operativa."
date: 2026-09-05
lang: ca
translationKey: operating-postgresql-redis-celery-8gb-vps
tags: ["DevOps", "PostgreSQL", "Redis", "Celery", "Docker", "Production"]
draft: false
cover: "/og/operating-postgresql-redis-celery-8gb-vps.png"
featured: false
---

Executar una aplicació de machine learning en producció acostuma a implicar molt més que servir un model.

Les meves aplicacions utilitzen PostgreSQL per a l'estat persistent, Redis per a la coordinació, Celery per al treball asíncron, FastAPI per a les API, React per a les interfícies d'usuari i Docker per empaquetar els serveis. TenderWise també executa ingestió programada de dades de contractació pública i càrregues opcionals d'IA. Payrithm afegeix processament asíncron al voltant de factures, fluxos de predicció i operacions de cobrament.

La restricció interessant és que no executo aquests sistemes en un gran clúster de Kubernetes.

Els executo en un VPS relativament petit amb **8 GB de RAM i 80 GB d'emmagatzematge**.

Aquesta restricció ha estat útil. M'obliga a pensar en el consum de recursos en lloc d'amagar la ineficiència darrere d'una màquina més gran.

La lliçó central ha estat senzilla:

> En un servidor petit, la planificació de capacitat forma part de l'arquitectura de l'aplicació.

## L'arquitectura

A l'extrem públic faig servir una configuració compartida de Nginx i Certbot.

Conceptualment, el servidor té aquest aspecte:

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
            +-- tasques de backup
```

El reverse proxy públic sap com encaminar els dominis. Les bases de dades de les aplicacions no ho necessiten.

Només els serveis que necessiten trànsit extern s'uneixen a la xarxa pública del proxy. PostgreSQL, Redis i els workers en segon pla es mantenen en xarxes privades de Docker.

Això em dona una frontera útil tant de seguretat com operativa: una base de dades no necessita un port exposat al host simplement perquè l'aplicació que la utilitza sigui pública.

## Vuit gigabytes no són vuit gigabytes per a Celery

Un error habitual en dimensionar workers en segon pla és mirar la màquina i pensar:

```text
8 GB de RAM
per tant
hi ha espai de sobres per a workers
```

Però el pool de workers és només un dels consumidors.

La memòria també és necessària per a:

- el sistema operatiu,
- Docker,
- PostgreSQL,
- Redis,
- processos FastAPI,
- contenidors de frontend,
- Nginx,
- tasques programades,
- backups,
- i la memòria cau del sistema de fitxers.

Si també s'està executant un model local d'IA opcional, el càlcul canvia encara més dràsticament.

Per tant, la pregunta correcta no és:

> Quants workers de Celery puc iniciar?

És:

> Quanta memòria i CPU pot consumir el processament en segon pla sense degradar l'aplicació interactiva?

Aquesta distinció importa.

## PostgreSQL també necessita un pressupost de connexions

La concurrència de Celery no només consumeix CPU i memòria. També pot multiplicar les connexions a la base de dades.

Imaginem un servei d'API amb el seu propi pool de connexions SQLAlchemy i diversos processos de Celery que poden obrir connexions a la base de dades de manera independent.

Augmentar la concurrència dels workers de quatre a vuit pot potencialment duplicar el nombre de consumidors simultanis de la base de dades.

Si diverses aplicacions comparteixen el mateix servidor, aquesta multiplicació es produeix independentment a cada stack.

Per això, quan canvio la concurrència de Celery també penso en:

```text
processos de worker
×
possibles connexions DB per procés
+
pools de connexions de l'API
+
connexions administratives/en segon pla
```

PostgreSQL és extremadament fiable, però obrir un nombre arbitrari de connexions no és gratuït.

En una màquina petita, pools deliberadament modestos sovint són millors que valors per defecte grans.

## Redis ha de coordinar la feina, no convertir-se en la feina

Redis és lleuger en comparació amb molts altres serveis, però és fàcil oblidar que l'estat de les cues també consumeix memòria.

Si els productors poden afegir tasques a la cua més ràpidament del que els workers poden processar-les, la cua es converteix en un sistema d'emmagatzematge de feina inacabada.

Normalment això indica que hi ha algun altre problema.

Una arquitectura asíncrona saludable necessita alguna forma de backpressure.

Per exemple, una tasca programada d'ingestió no hauria de crear contínuament milers de tasques duplicades perquè el cicle anterior encara no ha acabat.

Prefereixo tasques programades idempotents i un estat de cua observable.

A TenderWise, els avisos de contractació que han fallat també tenen estat persistent de reintent a PostgreSQL. Això significa que Redis no s'ha de convertir en el registre durable del que ha fallat i per què.

La base de dades pot conservar camps com:

```text
avís
nombre d'intents
últim error
estat
proper moment de reintent
```

Celery és responsable d'executar el reintent.

Aquesta separació fa que la recuperació sigui molt més fàcil de raonar.

## No totes les tasques en segon pla són iguals

Una de les raons per les quals la capacitat de Celery es complica és que les durades de les tasques poden ser radicalment diferents.

TenderWise utilitza processament asíncron per a feines com:

- sincronització de TED,
- reintents d'avisos fallits,
- manteniment d'oportunitats caducades,
- enviament de correu electrònic,
- resums programats,
- resums de licitacions amb IA,
- i registre de salut dels workers.

Una tasca de correu electrònic i una tasca de generació amb IA no s'han de tractar com si fossin càrregues equivalents.

De la mateixa manera, descarregar i analitzar un avís de contractació gran pot ocupar un worker molt més temps que actualitzar un heartbeat.

Un model mental útil és:

```text
CURTES
correu electrònic
notificacions
actualitzacions petites

MITJANES
normalització
scoring
neteja programada

LLARGUES
ingestió massiva
entrenament de models
generació amb IA
```

Quan les càrregues es classifiquen d'aquesta manera, la capacitat dels workers és més fàcil de dissenyar.

Aleshores es pot introduir separació de cues quan sigui necessari:

```text
Redis
 |
 +-- default ------> workers generals
 |
 +-- ingestion ----> workers d'ingestió
 |
 +-- ml/ai --------> workers costosos
```

La topologia exacta depèn de la càrrega de treball. El punt important és que una tasca llarga no hauria d'impedir innecessàriament l'execució d'una tasca curta i visible per a l'usuari.

## Augmentar la concurrència pot fer que el sistema sigui més lent

La resposta més evident a la saturació dels workers és simplement:

> Afegir més workers.

De vegades és correcte.

Però augmentar la concurrència també pot crear:

- més contenció de CPU,
- més connexions a la base de dades,
- més peticions de xarxa simultànies,
- més pressió de memòria,
- i més canvis de context.

Per tant, un pool de workers és una decisió d'assignació de recursos, no un regulador de velocitat.

L'experiment que m'interessa no és només:

```text
tasques / segon
```

És:

```text
throughput en segon pla
mentre
la latència de l'API es manté acceptable
i
la memòria es manté estable
```

Aquestes restriccions s'han de mesurar conjuntament.

> **Mesura a afegir abans de publicar:** comparar la concurrència dels workers, el temps d'espera a la cua, la latència p95 de l'API i l'ús de RAM per a almenys dues configuracions.

## Vigilar l'edat de la cua, no només la CPU

L'ús de CPU em diu si la màquina està ocupada.

No em diu si els usuaris estan esperant que s'executi una tasca.

En sistemes asíncrons m'importen:

- profunditat de la cua,
- edat de la tasca més antiga a la cua,
- temps d'execució de les tasques,
- taxa d'errors de les tasques,
- heartbeat dels workers,
- i nombre de reintents.

Una cua amb 200 tasques pot estar bé si cadascuna tarda 20 mil·lisegons.

Cinc tasques a la cua poden ser un problema si cadascuna necessita deu minuts.

L'edat de la tasca inacabada més antiga sovint és més útil que la longitud bruta de la cua.

## El disc forma part del model de capacitat

El VPS també té un disc finit de 80 GB.

Les bases de dades creixen. Les imatges de Docker s'acumulen. Els logs creixen. Els backups creixen. Les capes de build antigues continuen ocupant espai si no es netegen.

Per tant, producció requereix controls poc espectaculars però necessaris:

```text
rotació de logs
retenció de backups
neteja d'imatges Docker
monitoratge de la base de dades
alertes d'ús de disc
```

Una màquina amb RAM disponible encara pot fallar de manera espectacular si PostgreSQL es troba amb un sistema de fitxers ple.

## Què he après

El servidor ha canviat la manera com penso sobre l'arquitectura de producció.

Ja no tracto PostgreSQL, Redis i Celery com tecnologies independents.

Formen un sistema de recursos.

Augmentar una part modifica la pressió sobre les altres.

Més concurrència de Celery pot significar més connexions a PostgreSQL. Una ingestió més ràpida pot significar cues més grans i un creixement més ràpid de la base de dades. Més logging pot millorar el debugging alhora que consumeix disc.

Per tant, l'objectiu no és la utilització màxima.

És una utilització predictible.

Per a sistemes de producció petits, sovint és un objectiu d'enginyeria millor que intentar reproduir l'arquitectura d'una empresa que opera centenars de servidors.

Un VPS modest pot executar aplicacions sorprenentment capaces.

Però només si cada servei recorda que comparteix la màquina.
