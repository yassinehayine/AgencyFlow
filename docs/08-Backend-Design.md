# AgencyFlow — Backend Blueprint

| Field | Value |
|---|---|
| **Document ID** | `08-Backend-Design` |
| **Phase** | Phase 6 — Backend Design |
| **Version** | 1.0 (Draft — pending approval) |
| **Date** | 2026-07-30 |
| **Author** | Senior Software Architect |
| **Status** | Awaiting stakeholder approval |
| **Scope** | **Concise blueprint** — deliberately not an exhaustive specification |
| **Binding inputs** | `01-SRS` v1.1 · `05-Architecture` · `06-Database-Design` · `07-UML-Design` · ADR-0001 – ADR-0004 |

| Role | Name | Decision | Date |
|---|---|---|---|
| Project Owner | Yassine | ☐ Approved ☐ Changes requested | |

---

## 0. Scope of this document

**Decision (Project Owner, 2026-07-30):** Phase 6 produces a *blueprint*, not a full specification. Endpoint-by-endpoint definitions, DTO field lists, and per-rule pseudocode are **deferred to implementation**.

**Rationale.** Detailed endpoint specs written before any code exists are largely rewritten once the code is written, and the requirement baseline is already frozen and traceable. The remaining decisions are local and low-risk; the binding ones are already made in Phases 3–5.

**This document settles the six things that are expensive to change later** and are therefore worth deciding now: module boundaries, API shape, the authorization mechanism, the contract/validation strategy, the error model, and the folder layout.

**Constraint on deferred decisions:** anything decided during implementation must remain consistent with the approved SRS, Architecture, Database Design, and UML. Where implementation reveals a design is wrong, `00-Project-Foundation.md` §13.6 applies — record it, fix the document in the same PR, never deviate silently.

---

## 1. Module Decomposition

15 modules: 11 feature, 4 core. One-directional dependencies (`05-Architecture` §7).

### 1.1 Core modules — depended upon, never depending

| Module | Provides | Notes |
|---|---|---|
| `ConfigModule` | Typed, **boot-validated** environment config | Missing variable ⇒ startup failure, not a runtime surprise |
| `DatabaseModule` | Mongoose connection, `ScopedRepository<T>` base | Every repository extends this |
| `AuthorizationModule` | `AccessScope` builder, guards, policy helpers | **The BR-10 mechanism** |
| `StorageModule` | `IStorageService` + Cloudinary adapter | ADR-0003 |
| `EventsModule` | `@nestjs/event-emitter` wrapper, event constants | `05-Architecture` §9 |
| `CommonModule` | Exception filter, logging interceptor, pipes, decorators | Cross-cutting HTTP concerns |

### 1.2 Feature modules

| Module | Owns | Exports | Depends on |
|---|---|---|---|
| `AuthModule` | Login, JWT, password hashing | `AuthService` | Users |
| `UsersModule` | Accounts, roles, skills, usernames | `UsersService` | — |
| `ClientsModule` | Client organizations + their contacts | `ClientsService` | Users |
| `ProjectsModule` | Projects, **embedded milestones**, **embedded team**, progress computation | `ProjectsService`, `MilestoneProgressService` | Users, Clients |
| `TasksModule` | Tasks + state machine | `TasksService` | Projects |
| `DeliverablesModule` | Deliverables, embedded versions, approval workflow | `DeliverablesService` | Projects |
| `FilesModule` | Upload validation, scoped download, `projectFiles` | `FilesService` | Projects, Tasks, Deliverables |
| `CommentsModule` | Comments, mention resolution | `CommentsService` | Users |
| `NotificationsModule` | In-app notifications | `NotificationsService` | *(event subscriber only)* |
| `ActivitiesModule` | Immutable activity log | `ActivitiesService` | *(event subscriber only)* |
| `DashboardsModule` | Role read models, deadline computation | — | Projects, Tasks, Deliverables, Activities |

**🟡/🟢 modules** — `SearchModule`, `TemplatesModule`, `ReportsModule` — are created only when their priority is reached.

### 1.3 Two boundary rules worth restating

- **`ProjectsModule` is the sole writer of the `projects` document.** Milestones and team membership are embedded (ADR-0004), so no other module may touch them. This is why there is no `MilestonesModule`.
- **`NotificationsModule` and `ActivitiesModule` are subscribers only.** No business module imports them. Adding an `EmailListener` later touches zero business code — that is NFR-31 made real.

---

## 2. REST API Structure

Base: `/api/v1`. Conventions per `00-Project-Foundation.md` §12.5.

### 2.1 Resource map

| Resource | Verbs | Notes |
|---|---|---|
| `/auth` | `POST /login`, `POST /logout`, `PATCH /password` | — |
| `/users` | CRUD | Admin only; `PATCH /:id/deactivate` guarded by BR-32 |
| `/clients` | CRUD | `GET|POST /:id/contacts` |
| `/projects` | CRUD | Scoped by role (BR-10, BR-25, BR-26) |
| `/projects/:id/milestones` | CRUD | Writes into the embedded array |
| `/projects/:id/team` | `GET`, `POST`, `DELETE /:userId` | BR-23, BR-24 |
| `/projects/:id/tasks` | `GET`, `POST` | Creation is always project-nested |
| `/tasks/:id` | `GET`, `PATCH`, + **commands** | See §2.2 |
| `/projects/:id/deliverables` | `GET`, `POST` | — |
| `/deliverables/:id` | `GET` + **commands** | See §2.2 |
| `/deliverables/:id/versions/:n/files` | `POST`, `GET /:fileId`, `DELETE /:fileId` | Context-scoped (`06-DB` §4.4) |
| `/tasks/:id/attachments` | `POST`, `GET /:fileId`, `DELETE /:fileId` | — |
| `/projects/:id/files` | `GET`, `POST` | Client Contacts may POST (BR-27) |
| `/comments` | `GET ?targetType&targetId`, `POST`, `DELETE /:id` | — |
| `/notifications` | `GET`, `PATCH /:id/read`, `PATCH /read-all` | 🟡 |
| `/projects/:id/activities` | `GET` | 🟡 — visibility-filtered |
| `/dashboard` | `GET` | Shape varies by role |
| `/search` `/project-templates` `/reports` | — | 🟡 / 🟢 |

### 2.2 Command endpoints — state transitions

Transitions are **named `POST` sub-resources**, never `PATCH { status }` (`05-Architecture` §10.3). There is no generic status-write path, which is what makes BR-04, BR-05, and BR-07 unbypassable.

| Command | Guard |
|---|---|
| `POST /tasks/:id/start` | assignee only |
| `POST /tasks/:id/submit-review` | assignee only |
| **`POST /tasks/:id/done`** | **PM/Admin only, from `IN_REVIEW` — BR-04** |
| `POST /tasks/:id/return` | PM/Admin, from `IN_REVIEW` |
| `POST /tasks/:id/block` | assignee or PM; **reason mandatory — BR-22** |
| `POST /tasks/:id/unblock` | assignee or PM |
| `POST /tasks/:id/cancel` | PM/Admin |
| **`POST /deliverables/:id/submit`** | **PM/Admin, ≥ 1 file — BR-05** |
| `POST /deliverables/:id/versions` | PM/Admin, from `CHANGES_REQUESTED` — **appends, never overwrites (BR-06)** |
| **`POST /deliverables/:id/start-review`** | **Client of owning org, from `SUBMITTED` — FR-081, BR-31** |
| `POST /deliverables/:id/approve` | Client of owning org — **terminal (BR-07)** |
| `POST /deliverables/:id/request-changes` | Client of owning org; **comment mandatory** |

### 2.3 Conventions

- **No `GET` mutates state** (BR-31) — reads are safe and idempotent.
- All list endpoints paginated: `?page&pageSize&sortBy&sortOrder`, capped `pageSize` (NFR-17).
- Responses never include `passwordHash` or `storageKey`.
- `clientId`, `role`, and status values are **never** accepted from a request body.

---

## 3. Authentication and Authorization

### 3.1 JWT payload

```
{ sub: userId, role: Role, clientId?: string, iat, exp }
```

`clientId` is present only for `CLIENT_CONTACT`. Signed, 12-hour expiry (BR-13). No refresh token, no server-side session.

### 3.2 Request pipeline

```
Request → JwtAuthGuard → RolesGuard → Controller → Service → ScopedRepository → MongoDB
             │               │                        │              │
       signature valid?  role may            BR-04/05/07/25    scope applied
       user still         reach route?       policy checks     to every query
       active? →
       build AccessScope
       from the RECORD
```

Four layers, each catching what the previous cannot (`05-Architecture` §11.2). `RolesGuard` answers *"is this user a PM?"*; only the service can answer *"is this user the PM **of this project**, and is the task **in review**?"*

> **Amended 2026-08-01.** Two corrections against the implementation. There is no separate `ScopeInterceptor`: the scope is built inside `JwtStrategy`, at the one point where the signature has just been verified, which removes any window in which a request exists without a scope. And it is built from the re-read user record rather than from the token (ADR-0005), which is why the "user still active?" check sits in layer 1.

### 3.3 `AccessScope`

Built once per request from the **stored user record**, identified by the signed token — never from a body or query parameter.

> **Amended 2026-08-01 by [ADR-0005](adr/0005-per-request-user-revalidation.md).** Originally *"from the signed token only"*. `JwtStrategy` now re-reads the acting user on every authenticated request and refuses the request if that user is inactive or deleted. The token proves **who**; the database decides **what they may do**. Cost: one indexed `_id` read per authenticated request. Public routes are unaffected — `JwtAuthGuard` short-circuits on `@Public()` before the strategy runs. `AccessScope.fromClaims()` is accordingly named `AccessScope.forUser()`.

```ts
interface AccessScope {
  userId: string;
  role: Role;
  clientId?: string;              // CLIENT_CONTACT only
  accessibleProjectIds(): Promise<string[]>;   // lazy, memoized per request
}
```

**Resolution strategy** — the one decision here worth stating precisely:

| Case | Approach |
|---|---|
| **Project-nested routes** (most writes) | `projectId` comes from the path. Authorize that one project once; no list resolution needed |
| **Cross-project reads** (dashboards, "my tasks", search) | Resolve the accessible project id list **lazily and memoized per request** |

Resolving the full project list eagerly on every request would add a query to every call, including the many that never need it. Resolving it lazily keeps the common path at zero cost while keeping the scope mandatory where it matters.

**Scope filters by role:**

| Role | Project filter |
|---|---|
| `ADMINISTRATOR` | none |
| `PROJECT_MANAGER` | `projectManagerId = userId` |
| `TEAM_MEMBER` | `teamMembers.userId = userId` |
| `CLIENT_CONTACT` | `clientId = scope.clientId` 🔒 |

Every `ScopedRepository` method takes `scope` as a **required** parameter. Omitting it is a compile error, not a data leak.

---

## 4. Contracts, DTOs and Validation

### 4.1 Two-layer contract strategy

| Layer | Location | Contents |
|---|---|---|
| **Shared types** | `packages/contracts` | Interfaces, enums, constants. **Pure TypeScript, zero runtime dependencies** |
| **Backend DTOs** | `apps/api/**/dto` | `class-validator` classes that **implement** the shared interfaces |

The contracts package deliberately excludes decorated DTO classes — they would ship `reflect-metadata` to the browser for no benefit. The frontend still gets full compile-time safety: rename a field in `contracts`, and the web build fails in CI (ADR-0001, QA-7).

### 4.2 Validation

Global `ValidationPipe`:

```
{ whitelist: true, forbidNonWhitelisted: true, transform: true }
```

**`forbidNonWhitelisted` rejects rather than strips unknown properties.** A client sending `role` or `clientId` gets a `400` — silent stripping would hide an attempted privilege escalation instead of surfacing it.

| Validated where | What |
|---|---|
| DTO (`class-validator`) | Shape, types, lengths, formats, enum membership |
| **Service** | Every business rule — ownership, state, cross-entity invariants |
| `FileValidationPipe` | Extension, size, **actual content type** (NFR-24 — the client header is not trusted) |

**Business rules never live in DTOs.** `@IsEnum(TaskStatus)` proves a value is a valid status; only the service knows whether *this actor* may move *this task* into it.

---

## 5. Error Handling

### 5.1 Response envelope

```json
{
  "statusCode": 403,
  "code": "TASK_COMPLETION_FORBIDDEN",
  "message": "Seul un chef de projet peut marquer une tâche comme terminée.",
  "correlationId": "b3f1…",
  "timestamp": "2026-07-30T14:22:31.000Z",
  "path": "/api/v1/tasks/64a1.../done"
}
```

`code` is stable and machine-readable; `message` is French for display (NFR-01). Validation errors add a `details[]` array.

### 5.2 Exception hierarchy

`DomainException` (abstract) → `NotFoundException` · `ForbiddenException` · `ConflictException` · `BusinessRuleViolationException`

Services throw domain exceptions; a single global filter maps them to HTTP. Services never import HTTP types (`05-Architecture` §8.1).

### 5.3 Mapping

| Condition | Status | Example code |
|---|---|---|
| Validation failure | `400` | `VALIDATION_FAILED` |
| Missing/expired token | `401` | `UNAUTHENTICATED` |
| Role or ownership denied | `403` | `TASK_COMPLETION_FORBIDDEN` |
| Not found **or out of scope** | `404` | `RESOURCE_NOT_FOUND` |
| Uniqueness / state conflict | `409` | `EMAIL_ALREADY_EXISTS` |
| Business rule violated | `422` | `DELIVERABLE_ALREADY_APPROVED` |
| Unexpected | `500` | `INTERNAL_ERROR` |

> 🔒 **Cross-organization access returns `404`, never `403`.** A `403` confirms the resource exists, which is itself a disclosure. Out-of-scope and non-existent must be indistinguishable (BR-10, `05-Architecture` §10.5).

**Never leaked:** stack traces, internal paths, Mongo errors, `passwordHash`, `storageKey` (NFR-23). Every `500` is logged in full with its `correlationId`; the client receives only the id.

---

## 6. Folder Structure

```
apps/api/src/
├── main.ts
├── app.module.ts
│
├── core/
│   ├── config/           # env schema, boot validation
│   ├── database/         # connection, ScopedRepository<T>, audit plugin
│   ├── authorization/    # AccessScope, guards, policies, @CurrentScope()
│   ├── storage/          # IStorageService, cloudinary.adapter, in-memory fake
│   └── events/           # event bus, event name constants
│
├── common/
│   ├── filters/          # global exception filter
│   ├── interceptors/     # logging + correlation id, scope
│   ├── pipes/            # file validation
│   ├── decorators/       # @Roles(), @CurrentUser(), @CurrentScope()
│   └── dto/              # pagination, error envelope
│
├── modules/
│   ├── auth/
│   ├── users/
│   ├── clients/
│   ├── projects/         # + milestones, team, progress
│   ├── tasks/
│   ├── deliverables/
│   ├── files/
│   ├── comments/
│   ├── notifications/    # listeners/
│   ├── activities/       # listeners/
│   └── dashboards/
│
└── i18n/fr.ts            # French message constants (NFR-06)
```

Each feature module follows the identical internal shape from `05-Architecture` §8:

```
modules/<feature>/
├── <feature>.controller.ts
├── <feature>.service.ts        # ALL business rules
├── <feature>.repository.ts     # ONLY place queries are written
├── dto/
├── schemas/                    # private to the module
└── <feature>.module.ts
```

---

## 7. Decisions Deferred to Implementation

Explicitly deferred — with the constraints that bind them, so deferral is not a blank cheque.

| Deferred | Must respect |
|---|---|
| Exact DTO field lists | `06-Database-Design` §7 field definitions |
| Full endpoint list and response shapes | §2 resource map and command conventions |
| Complete error-code catalogue | §5 envelope and mapping table |
| Event payload shapes | `06-DB` §6 ActivityType / NotificationType |
| Pagination defaults and caps | NFR-17 |
| Mongoose schema options, virtuals, hooks | ADR-0004 audit and soft-delete policy |
| Swagger/OpenAPI annotations | Generated from DTOs; no separate hand-written spec |
| Seed data | The 4 roles, realistic French sample content |

**Non-negotiable regardless:** every repository method takes an `AccessScope`; business rules live only in services; no `GET` mutates state; unique indexes are partial on `deletedAt: null`; milestone progress is never stored.

---

## 8. Exit Criteria

- [x] Module decomposition with explicit dependencies and exports
- [x] REST resource map and command-endpoint convention
- [x] Authentication and 4-layer authorization flow, with the `AccessScope` resolution strategy
- [x] Shared contract and validation strategy
- [x] Error envelope, exception hierarchy, and status mapping
- [x] Folder structure
- [x] Deferred decisions registered with binding constraints
- [ ] **Project Owner approval**

---

## END OF PHASE 6 DELIVERABLE

On approval, implementation begins with **Slice 1 — Access**: repository scaffolding, core modules, auth, users, clients, and the `AccessScope` mechanism, per `02-User-Stories` §2.
