---
title: "Construint un SaaS multi-tenant amb FastAPI i PostgreSQL"
description: "Com estructuro l'aïllament per workspace, els permisos, les tasques en segon pla, la facturació i l'estat d'auditoria quan converteixo una aplicació FastAPI en un SaaS multi-tenant."
date: 2026-10-12
publishAt: 2026-10-12T08:00:00+02:00
lang: ca
translationKey: multi-tenant-fastapi-postgresql-saas
tags: ["FastAPI", "PostgreSQL", "SaaS", "Python", "Security", "Backend"]
draft: false
cover: "/og/multi-tenant-fastapi-postgresql-saas.png"
featured: false
project: "tenderwise"
---

Afegir autenticació a una aplicació no la converteix automàticament en multi-tenant.

Un compte d'usuari respon:

> Qui està fent aquesta petició?

Una aplicació SaaS també ha de respondre:

> Sobre les dades de quina organització està autoritzat a operar aquest usuari?

Aquesta segona pregunta va definir bona part del disseny backend de **TenderWise**.

TenderWise s'organitza al voltant de workspaces. Els perfils d'empresa, les decisions de contractació pública, els espais de treball de licitació, l'activitat de l'equip, els límits de facturació i els esdeveniments d'auditoria existeixen dins del context d'un tenant.

La regla arquitectònica és senzilla:

> Un workspace és una frontera de seguretat, no només una agrupació de la interfície.

## El model de dades bàsic

A nivell conceptual:

```text
User
 |
 v
WorkspaceMembership
 |
 +---- role
 |
 v
Workspace
 |
 +---- company profiles
 +---- assessments
 +---- bid workspaces
 +---- tasks
 +---- notifications
 +---- usage state
 +---- audit events
```

Els usuaris i els workspaces són entitats separades perquè la relació és de molts a molts.

Un usuari pot pertànyer a múltiples workspaces.

Un workspace pot contenir múltiples usuaris.

Per tant, el registre de membership és on ha de residir el context d'autorització.

## Autenticació i autorització del tenant són coses diferents

L'autenticació pot produir:

```python
current_user
```

però un endpoint de workspace necessita més context:

```python
current_user
current_workspace
membership
role
```

Una dependència simplificada de FastAPI podria semblar conceptualment així:

```python
async def require_workspace_member(
    workspace_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    membership = await find_membership(
        session,
        workspace_id=workspace_id,
        user_id=current_user.id,
    )

    if membership is None:
        raise HTTPException(status_code=404)

    return membership
```

Prefereixo deliberadament fer l'autorització al límit de la petició en lloc de confiar que cada servei posterior recordarà comprovar-la.

## Cada consulta d'un tenant hauria de tenir un abast evident

La consulta perillosa és:

```python
select(BidWorkspace).where(
    BidWorkspace.id == bid_id
)
```

perquè l'ID de l'objecte es converteix en l'única frontera.

El model mental més segur és:

```python
select(BidWorkspace).where(
    BidWorkspace.id == bid_id,
    BidWorkspace.workspace_id == workspace.id,
)
```

Encara que els identificadors siguin difícils d'endevinar, l'autorització no hauria de dependre del secretisme.

Aquest principi s'hauria d'aplicar de manera coherent a:

- perfils,
- assessments,
- tasques,
- comentaris,
- notificacions,
- registres d'ús,
- i estat de facturació.

Si l'objecte pertany a un tenant, l'abast del tenant hauria de ser visible a la consulta o estar garantit per l'abstracció de servei utilitzada per accedir-hi.

## No tractis mai un ID de tenant com a autorització

El navegador, òbviament, necessita identificar quin workspace està actiu.

Però el backend no hauria d'interpretar:

```json
{ "workspace_id": "..." }
```

com una autorització.

L'identificador del workspace indica quin tenant vol l'usuari.

La comprovació de membership indica si té permís per utilitzar-lo.

Això sembla obvi quan s'escriu. És menys obvi quan existeixen desenes d'endpoints i processos en segon pla.

## Les comprovacions de rol s'han de construir sobre la membership

Un cop establerta la membership, els rols poden respondre preguntes més concretes:

```text
Aquesta persona pot convidar membres?
Aquesta persona pot modificar la facturació?
Aquesta persona pot modificar una decisió de licitació?
Aquesta persona només pot veure el workspace?
```

Prefereixo un conjunt petit de rols i comprovacions de permisos explícites abans que condicionals dispersos.

La lògica d'autorització hauria de ser avorrida.

Una autorització avorrida és més fàcil d'auditar.

## Les tasques en segon pla també necessiten context del tenant

El multi-tenancy es torna més interessant quan una petició posa feina asíncrona a una cua.

Per exemple:

```text
browser
  |
  v
FastAPI
  |
  v
Celery
  |
  v
generate tender brief
```

El worker ja no s'executa dins del context d'autorització de la petició HTTP original.

Per tant, la tasca necessita prou identificadors per reconstruir l'abast correcte al servidor.

Un patró útil és posar a la cua IDs interns estables:

```python
generate_brief.delay(
    workspace_id=str(workspace.id),
    assessment_id=str(assessment.id),
)
```

Després, el worker carrega l'assessment restringit al workspace proporcionat.

No hauria de confiar en dades d'usuari serialitzades arbitràriament i enviades des del frontend.

L'aïllament entre tenants ha de sobreviure a la transició de petició HTTP a procés asíncron.

## La facturació també és estat del tenant

Les subscripcions solen ser propietats d'un workspace o organització, no de peticions API individuals.

Això significa que el backend de vegades ha de respondre tres preguntes diferents:

```text
Aquest usuari està autenticat?
Aquest usuari està autoritzat en aquest workspace?
Aquest workspace té dret a executar aquesta operació?
```

Són decisions diferents.

Combinar-les en una única dependència gran acaba sent difícil de mantenir, així que prefereixo mantenir els conceptes separats.

## Els logs d'auditoria necessiten la mateixa frontera

Les accions que modifiquen un workspace es poden registrar amb:

```text
actor
workspace
acció
tipus d'objecte
ID de l'objecte
timestamp
metadata
```

El camp `workspace` importa tant com l'actor.

Un administrador de plataforma pot acabar necessitant inspeccionar activitat entre tenants, mentre que un administrador normal de workspace només hauria de veure esdeveniments de la seva pròpia organització.

Per tant, les dades d'auditoria també necessiten aïllament per tenant.

## Els errors de tenant necessiten proves negatives

Les proves més importants no són:

> Pot l'Alice carregar la licitació de l'Alice?

Són:

> Pot l'Alice carregar la licitació d'en Bob si coneix l'ID?

Per als recursos sensibles al tenant vull proves que creïn explícitament dos workspaces:

```text
Workspace A
    User A
    Bid A

Workspace B
    User B
    Bid B
```

i després intentin:

```text
User A -> Bid B
```

El resultat esperat és sempre denegació.

Hi hauria d'haver proves similars per a:

- actualitzacions,
- eliminacions,
- tasques en segon pla,
- rutes d'administració,
- canvis de facturació,
- i invitacions d'equip.

Una aplicació multi-tenant necessita proves d'aïllament de la mateixa manera que un motor de scoring necessita proves de correcció.

## PostgreSQL fa pràctica la propietat explícita

Un avantatge d'una base de dades relacional és que les relacions de tenant es poden representar directament.

Per exemple:

```text
workspace
    |
    +-- profiles
    |
    +-- bids
          |
          +-- tasks
```

Les claus foranes fan més difícil crear relacions no vàlides.

Els índexs que inclouen `workspace_id` també poden donar suport als patrons d'accés utilitzats per l'API.

Per tant, l'esquema de base de dades passa a formar part de l'arquitectura de seguretat en lloc de ser simplement emmagatzematge persistent.

## Els backups canvien quan la base de dades és compartida

Una base de dades PostgreSQL compartida pot contenir dades de molts workspaces.

Això fa que la integritat dels backups sigui especialment important.

Una estratègia de backup no és completa només perquè s'hagi creat un fitxer.

Les preguntes reals són:

```text
Es pot restaurar el backup?
Quantes còpies es conserven?
Quant espai de disc consumeixen?
Què passa si la base de dades actual deixa d'estar disponible?
```

El multi-tenancy augmenta el radi d'impacte d'una fallada de base de dades, així que la recuperació mereix la mateixa atenció.

## La lliçó principal

El multi-tenancy no és una funcionalitat que jo afegiria al final.

Afecta:

```text
esquema de base de dades
dependències de l'API
autorització
tasques en segon pla
facturació
logs d'auditoria
proves
backups
```

La regla més simple que he trobat és:

> Cada operació sobre dades propietat d'un tenant hauria de fer evident la frontera del tenant.

Quan aquesta regla s'aplica de manera coherent, FastAPI i PostgreSQL ofereixen una base molt bona per a sistemes SaaS petits i mitjans.

La part difícil no és el framework.

És mantenir la frontera a tot arreu.
