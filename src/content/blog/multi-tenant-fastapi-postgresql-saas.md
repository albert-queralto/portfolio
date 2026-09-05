---
title: "Building a Multi-Tenant SaaS with FastAPI and PostgreSQL"
description: "How I structure workspace isolation, permissions, background jobs, billing and audit state when turning a FastAPI application into a multi-tenant SaaS."
date: 2026-10-12
publishAt: 2026-10-12T08:00:00+02:00
tags: ["FastAPI", "PostgreSQL", "SaaS", "Python", "Security", "Backend"]
draft: false
cover: "/og/multi-tenant-fastapi-postgresql-saas.png"
featured: false
project: "tenderwise"
---

Adding authentication to an application does not automatically make it multi-tenant.

A user account answers:

> Who is making this request?

A SaaS application also needs to answer:

> Which organization's data is this user allowed to operate on?

That second question shaped much of **TenderWise's** backend design.

TenderWise is organized around workspaces. Company profiles, procurement decisions, bid workspaces, team activity, billing limits and audit events exist in the context of one tenant.

The architectural rule is straightforward:

> A workspace is a security boundary, not just a UI grouping.

## The basic data model

At a conceptual level:

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

Users and workspaces are separate entities because the relationship is many-to-many.

A user can belong to multiple workspaces.

A workspace can contain multiple users.

The membership record is therefore where authorization context belongs.

## Authentication and tenant authorization are different

Authentication may produce:

```python
current_user
```

but a workspace endpoint needs more context:

```python
current_user
current_workspace
membership
role
```

A simplified FastAPI dependency might look conceptually like:

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

I deliberately prefer authorization at the request boundary instead of hoping every later service remembers to check it.

## Every tenant query should have an obvious scope

The dangerous query is:

```python
select(BidWorkspace).where(
    BidWorkspace.id == bid_id
)
```

because the object ID becomes the only boundary.

The safer mental model is:

```python
select(BidWorkspace).where(
    BidWorkspace.id == bid_id,
    BidWorkspace.workspace_id == workspace.id,
)
```

Even if identifiers are difficult to guess, authorization should not depend on secrecy.

This principle should apply consistently to:

- profiles,
- assessments,
- tasks,
- comments,
- notifications,
- usage records,
- and billing state.

If the object belongs to a tenant, tenant scope should be visible in the query or guaranteed by the service abstraction used to access it.

## Never treat a tenant ID as authorization

The browser obviously needs to identify which workspace is active.

But the backend should not interpret:

```json
{"workspace_id": "..."}
```

as authorization.

The workspace identifier says which tenant the user wants.

The membership check says whether they are allowed to use it.

This seems obvious when written down. It becomes less obvious when dozens of endpoints and background processes exist.

## Role checks should build on membership

Once membership has been established, roles can answer narrower questions:

```text
Can this person invite members?
Can this person change billing?
Can this person modify a bid decision?
Can this person only view the workspace?
```

I prefer a small set of explicit roles and permission checks over scattered conditionals.

Authorization logic should look boring.

Boring authorization is easier to audit.

## Background jobs need tenant context too

Multi-tenancy becomes more interesting when a request queues asynchronous work.

For example:

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

The worker is no longer executing inside the original HTTP authorization context.

The task therefore needs enough identifiers to reconstruct the correct server-side scope.

A useful pattern is to queue stable internal IDs:

```python
generate_brief.delay(
    workspace_id=str(workspace.id),
    assessment_id=str(assessment.id),
)
```

The worker then loads the assessment constrained to the supplied workspace.

It should not trust arbitrary serialized user data sent from the frontend.

Tenant isolation needs to survive the transition from HTTP request to asynchronous process.

## Billing is also tenant state

Subscriptions are usually properties of a workspace or organization, not individual API requests.

That means the backend sometimes needs to answer three separate questions:

```text
Is this user authenticated?
Is this user authorized in this workspace?
Is this workspace entitled to perform this operation?
```

Those are different decisions.

Combining them into one large dependency eventually becomes difficult to maintain, so I prefer keeping the concepts distinct.

## Audit logs need the same boundary

Mutating workspace actions can be recorded with:

```text
actor
workspace
action
object type
object ID
timestamp
metadata
```

The `workspace` field matters as much as the actor.

A platform administrator may eventually need to inspect activity across tenants, while a normal workspace administrator should only see events belonging to their own organization.

Audit data therefore needs tenant isolation too.

## Tenant bugs require negative tests

The most important tests are not:

> Can Alice load Alice's bid?

They are:

> Can Alice load Bob's bid if she knows the ID?

For tenant-sensitive resources I want tests that explicitly create two workspaces:

```text
Workspace A
    User A
    Bid A

Workspace B
    User B
    Bid B
```

and then try:

```text
User A -> Bid B
```

The expected result is always denial.

Similar tests should exist for:

- updates,
- deletes,
- background jobs,
- admin routes,
- billing changes,
- and team invitations.

A multi-tenant application needs isolation tests in the same way that a scoring engine needs correctness tests.

## PostgreSQL makes explicit ownership practical

One advantage of a relational database is that tenant relationships can be represented directly.

For example:

```text
workspace
    |
    +-- profiles
    |
    +-- bids
          |
          +-- tasks
```

Foreign keys make invalid relationships harder to create.

Indexes including `workspace_id` can also support the access patterns used by the API.

The database schema therefore becomes part of the security architecture rather than simply persistent storage.

## Backups change when the database is shared

A shared PostgreSQL database can contain data for many workspaces.

This makes backup integrity particularly important.

A backup strategy is not complete merely because a file was created.

The real questions are:

```text
Can the backup be restored?
How many copies are retained?
How much disk do they consume?
What happens if the current database becomes unavailable?
```

Multi-tenancy increases the blast radius of database failure, so recovery deserves equal attention.

## The main lesson

Multi-tenancy is not a feature I would add at the end.

It affects:

```text
database schema
API dependencies
authorization
background tasks
billing
audit logs
testing
backups
```

The simplest rule I have found is:

> Every operation on tenant-owned data should make the tenant boundary obvious.

Once that rule is consistently applied, FastAPI and PostgreSQL provide a very good foundation for small and medium SaaS systems.

The hard part is not the framework.

It is maintaining the boundary everywhere.
