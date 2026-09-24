---
title: "Construyendo un SaaS multi-tenant con FastAPI y PostgreSQL"
description: "Cómo estructuro el aislamiento por workspace, los permisos, las tareas en segundo plano, la facturación y el estado de auditoría al convertir una aplicación FastAPI en un SaaS multi-tenant."
date: 2026-10-12
publishAt: 2026-10-12T08:00:00+02:00
lang: es
translationKey: multi-tenant-fastapi-postgresql-saas
tags: ["FastAPI", "PostgreSQL", "SaaS", "Python", "Security", "Backend"]
draft: false
cover: "/og/multi-tenant-fastapi-postgresql-saas.png"
featured: false
project: "tenderwise"
---

Añadir autenticación a una aplicación no la convierte automáticamente en multi-tenant.

Una cuenta de usuario responde:

> ¿Quién está haciendo esta petición?

Una aplicación SaaS también necesita responder:

> ¿Sobre los datos de qué organización está autorizado a operar este usuario?

Esa segunda pregunta definió buena parte del diseño backend de **TenderWise**.

TenderWise se organiza alrededor de workspaces. Los perfiles de empresa, las decisiones de contratación pública, los espacios de trabajo de licitación, la actividad del equipo, los límites de facturación y los eventos de auditoría existen dentro del contexto de un tenant.

La regla arquitectónica es sencilla:

> Un workspace es una frontera de seguridad, no solo una agrupación de la interfaz.

## El modelo de datos básico

A nivel conceptual:

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

Los usuarios y los workspaces son entidades separadas porque la relación es muchos a muchos.

Un usuario puede pertenecer a varios workspaces.

Un workspace puede contener varios usuarios.

Por tanto, el registro de membership es donde debe vivir el contexto de autorización.

## Autenticación y autorización del tenant son cosas diferentes

La autenticación puede producir:

```python
current_user
```

pero un endpoint de workspace necesita más contexto:

```python
current_user
current_workspace
membership
role
```

Una dependencia simplificada de FastAPI podría verse conceptualmente así:

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

Prefiero deliberadamente realizar la autorización en el límite de la petición en lugar de confiar en que cada servicio posterior recuerde comprobarla.

## Cada consulta de un tenant debería tener un alcance evidente

La consulta peligrosa es:

```python
select(BidWorkspace).where(
    BidWorkspace.id == bid_id
)
```

porque el ID del objeto se convierte en la única frontera.

El modelo mental más seguro es:

```python
select(BidWorkspace).where(
    BidWorkspace.id == bid_id,
    BidWorkspace.workspace_id == workspace.id,
)
```

Aunque los identificadores sean difíciles de adivinar, la autorización no debería depender del secreto.

Este principio debería aplicarse de forma consistente a:

- perfiles,
- assessments,
- tareas,
- comentarios,
- notificaciones,
- registros de uso,
- y estado de facturación.

Si el objeto pertenece a un tenant, el alcance del tenant debería ser visible en la consulta o estar garantizado por la abstracción de servicio utilizada para acceder a él.

## Nunca trates un ID de tenant como autorización

El navegador necesita, obviamente, identificar qué workspace está activo.

Pero el backend no debería interpretar:

```json
{ "workspace_id": "..." }
```

como una autorización.

El identificador del workspace indica qué tenant quiere el usuario.

La comprobación de membership indica si tiene permiso para utilizarlo.

Esto parece obvio cuando se escribe. Se vuelve menos obvio cuando existen decenas de endpoints y procesos en segundo plano.

## Las comprobaciones de rol deberían construirse sobre la membership

Una vez establecida la membership, los roles pueden responder preguntas más concretas:

```text
¿Puede esta persona invitar miembros?
¿Puede esta persona cambiar la facturación?
¿Puede esta persona modificar una decisión de licitación?
¿Puede esta persona únicamente ver el workspace?
```

Prefiero un conjunto pequeño de roles explícitos y comprobaciones de permisos frente a condicionales dispersos.

La lógica de autorización debería ser aburrida.

Una autorización aburrida es más fácil de auditar.

## Las tareas en segundo plano también necesitan contexto del tenant

El multi-tenancy se vuelve más interesante cuando una petición encola trabajo asíncrono.

Por ejemplo:

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

El worker ya no se ejecuta dentro del contexto de autorización de la petición HTTP original.

Por tanto, la tarea necesita suficientes identificadores para reconstruir el alcance correcto en el servidor.

Un patrón útil es encolar IDs internos estables:

```python
generate_brief.delay(
    workspace_id=str(workspace.id),
    assessment_id=str(assessment.id),
)
```

Después, el worker carga el assessment restringido al workspace proporcionado.

No debería confiar en datos de usuario serializados arbitrariamente enviados desde el frontend.

El aislamiento entre tenants debe sobrevivir a la transición de petición HTTP a proceso asíncrono.

## La facturación también es estado del tenant

Las suscripciones suelen ser propiedades de un workspace u organización, no de peticiones API individuales.

Eso significa que el backend a veces necesita responder tres preguntas diferentes:

```text
¿Este usuario está autenticado?
¿Este usuario está autorizado en este workspace?
¿Este workspace tiene derecho a realizar esta operación?
```

Son decisiones distintas.

Combinarlas en una sola dependencia grande acaba siendo difícil de mantener, así que prefiero mantener los conceptos separados.

## Los logs de auditoría necesitan la misma frontera

Las acciones que modifican un workspace pueden registrarse con:

```text
actor
workspace
acción
tipo de objeto
ID del objeto
timestamp
metadata
```

El campo `workspace` importa tanto como el actor.

Un administrador de plataforma puede acabar necesitando inspeccionar actividad entre tenants, mientras que un administrador normal de workspace solo debería ver eventos de su propia organización.

Por tanto, los datos de auditoría también necesitan aislamiento por tenant.

## Los errores de tenant requieren pruebas negativas

Las pruebas más importantes no son:

> ¿Puede Alice cargar la licitación de Alice?

Son:

> ¿Puede Alice cargar la licitación de Bob si conoce el ID?

Para recursos sensibles al tenant quiero pruebas que creen explícitamente dos workspaces:

```text
Workspace A
    User A
    Bid A

Workspace B
    User B
    Bid B
```

y después intenten:

```text
User A -> Bid B
```

El resultado esperado es siempre denegación.

Deberían existir pruebas similares para:

- actualizaciones,
- eliminaciones,
- tareas en segundo plano,
- rutas de administración,
- cambios de facturación,
- e invitaciones de equipo.

Una aplicación multi-tenant necesita pruebas de aislamiento del mismo modo que un motor de scoring necesita pruebas de corrección.

## PostgreSQL hace práctica la propiedad explícita

Una ventaja de una base de datos relacional es que las relaciones de tenant pueden representarse directamente.

Por ejemplo:

```text
workspace
    |
    +-- profiles
    |
    +-- bids
          |
          +-- tasks
```

Las claves foráneas hacen más difícil crear relaciones inválidas.

Los índices que incluyen `workspace_id` también pueden dar soporte a los patrones de acceso utilizados por la API.

Por tanto, el esquema de base de datos pasa a formar parte de la arquitectura de seguridad en lugar de ser simplemente almacenamiento persistente.

## Los backups cambian cuando la base de datos es compartida

Una base de datos PostgreSQL compartida puede contener datos de muchos workspaces.

Esto hace que la integridad de los backups sea especialmente importante.

Una estrategia de backup no está completa simplemente porque se haya creado un archivo.

Las preguntas reales son:

```text
¿Puede restaurarse el backup?
¿Cuántas copias se conservan?
¿Cuánto espacio en disco consumen?
¿Qué ocurre si la base de datos actual deja de estar disponible?
```

El multi-tenancy aumenta el radio de impacto de un fallo de base de datos, así que la recuperación merece la misma atención.

## La lección principal

El multi-tenancy no es una funcionalidad que añadiría al final.

Afecta a:

```text
esquema de base de datos
dependencias de la API
autorización
tareas en segundo plano
facturación
logs de auditoría
pruebas
backups
```

La regla más sencilla que he encontrado es:

> Cada operación sobre datos propiedad de un tenant debería hacer evidente la frontera del tenant.

Cuando esa regla se aplica de forma consistente, FastAPI y PostgreSQL ofrecen una base muy buena para sistemas SaaS pequeños y medianos.

La parte difícil no es el framework.

Es mantener la frontera en todas partes.
