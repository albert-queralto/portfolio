---
title: "TenderWise"
description: "Un SaaS multilingüe de contractació pública que ingereix anuncis TED, puntua oportunitats segons perfils d'empresa, separa rellevància de qualificació i coordina la preparació d'ofertes."
lang: ca
translationKey: tenderwise
order: 2
featured: true
draft: false
status: "Deployed"
category: "Web"
focus: "SaaS de contractació · Suport a decisions"
image: "/projects/tenderwise/tenderwise.png"
ogImage: "/og/tenderwise.png"
article: "/blog/tenderwise/"
source: "https://github.com/albert-queralto/tender-wise"
preview: "https://tenderwise.albertqueralto.dev/"
technologies:
  - React
  - TypeScript
  - Vite
  - FastAPI
  - PostgreSQL
  - pgvector
  - Redis
  - Celery
  - Docker
  - Stripe
  - Ollama
metrics:
  - label: "Domini"
    value: "Contractació pública europea"
  - label: "Model de decisió"
    value: "Rellevància + qualificació"
  - label: "Arquitectura"
    value: "SaaS multiservici"
---

## El problema

Els equips de contractació pública han de decidir ràpidament si una licitació mereix preparar una oferta, però el material d'origen és dens, multilingüe i operativament incòmode.

Els anuncis TED contenen senyals valuosos sobre abast, ubicació, categories CPV, terminis, context del comprador, valor del contracte i requisits obligatoris. TenderWise converteix aquest flux en un espai de treball on els equips poden decidir què perseguir i coordinar la feina necessària per preparar una oferta.

## El meu enfocament

TenderWise separa descobriment, suport a la decisió i execució de l'oferta.

El sistema ingereix anuncis TED, els normalitza en oportunitats estructurades, els compara amb perfils d'empresa i després avalua dues preguntes diferents:

- L'oportunitat és estratègicament rellevant?
- L'empresa pot complir els requisits obligatoris coneguts?

Aquests dos eixos alimenten una recomanació determinista `BID`, `REVIEW` o `NO_BID`. La IA pot explicar i resumir el contingut de la licitació, però no substitueix la recomanació basada en regles.

## Ingestió de TED

El backend s'integra amb la TED Search API i desa l'XML TED canònic perquè l'històric dels anuncis continuï sent traçable. Els registres parsejats es converteixen en lots i oportunitats normalitzats que es poden filtrar per geografia, codis CPV, preferències de valor, terminis, font, estat i watchlist.

TenderWise també emmagatzema versions dels anuncis i l'estat d'ingestions fallides. Això permet reintentar errors transitoris i destacar canvis quan evoluciona un anunci d'origen.

## Rellevància i qualificació

Els perfils d'empresa defineixen què és important per a cada workspace: països objectiu, preferències CPV, exclusions, valors de contracte, capacitats, certificacions i altres evidències de qualificació.

La puntuació de rellevància respon si l'oportunitat ha de formar part del feed de l'equip. La puntuació de qualificació respon si l'equip sembla capaç de complir els requisits obligatoris ja extrets de l'anunci.

Mantenir aquests conceptes separats fa que la recomanació sigui més fàcil d'auditar. Una licitació pot ser estratègicament atractiva i, alhora, requerir revisió perquè un requisit obligatori és desconegut o manca evidència.

## Espai de treball de l'oferta

Quan una oportunitat mereix ser perseguida o revisada, TenderWise crea un espai de treball col·laboratiu per a l'oferta.

L'espai controla fases del workflow, terminis interns, rols nominats de l'equip d'oferta, tasques de preparació, checklists de requisits inicials, responsables, progrés de completitud i comentaris de l'equip. Això manté el sistema de decisió connectat amb la feina operativa necessària abans de presentar l'oferta.

## Operacions SaaS

TenderWise inclou la infraestructura de producte al voltant del workflow:

- Membres del workspace i permisos basats en rols
- Onboarding inicial
- Estat de subscripció Stripe i límits d'ús
- Logs d'auditoria per a accions que modifiquen el workspace
- Notificacions dins l'aplicació per a facturació, TED i esdeveniments d'oferta
- Visibilitat de salut de producció i còpies programades de PostgreSQL

Aquestes peces fan que el projecte sigui més que un parser de licitacions. Es comporta com una aplicació SaaS mantenible amb límits operatius, quotes i vies de recuperació.

## Informes opcionals amb IA

Els informes d'IA sobre licitacions s'encuen a través de Celery en lloc de bloquejar el navegador. Quan està habilitat, TenderWise pot generar un resum executiu, punts clau, riscos, incògnites, següents passos suggerits i explicacions en llenguatge planer dels requisits.

El proveïdor d'IA és configurable: es pot utilitzar un contenidor local d'Ollama a Docker Compose, o el worker pot cridar un proveïdor compatible amb OpenAI. Els informes cachejats es marquen com a obsolets quan canvia el model o la configuració del proveïdor.

## Arquitectura

El desplegament de producció utilitza un stack compartit de Nginx i Certbot per a `tenderwise.albertqueralto.dev`.

Darrere d'aquesta capa pública, l'aplicació React és servida per un contenidor web i redirigeix les peticions API a FastAPI. PostgreSQL amb pgvector desa les dades de l'aplicació, Redis coordina jobs de Celery, Celery Beat programa treball en segon pla i els workers gestionen ingestió TED, correu, digests, reintents i generació amb IA.

Només el servei web s'uneix a la xarxa pública del proxy. La base de dades, Redis, API, worker, scheduler, procés de backup i servei opcional d'Ollama romanen a la xarxa privada de Docker Compose de TenderWise.

## Estat actual

TenderWise està desplegat com un projecte SaaS orientat a producció. El següent treball de producte és refinar l'onboarding, ajustar els pesos de scoring amb usuaris reals, ampliar el monitoratge operatiu i continuar millorant l'espai de treball d'ofertes d'acord amb com els equips de contractació preparen realment les seves presentacions.
