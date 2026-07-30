# ADR-0004 — Aggregate Boundaries and Persistence Policy

| | |
|---|---|
| **Status** | **Accepted** — 2026-07-30 |
| **Deciders** | Project Owner, Architect |
| **Resolves** | D-2 – D-8 of the Domain & Data Model Review |
| **Affects** | The entire data model; binding input to Phase 4 (Database Design) and Phase 5 (UML) |
| **Related** | SRS §5 (Conceptual Domain Model), SRS v1.1 amendments |

---

## Context

Phase 2 identified **13 conceptual entities**. Before Phase 3, the domain model was reviewed to determine aggregate boundaries, embed-versus-reference decisions, cascade rules, and audit conventions — because every downstream artefact inherits these choices, and reversing them after implementation begins is expensive.

The review confirmed the domain is sound and requires **no change to any business rule**. It found that four entities have no independent lifecycle and should not become collections, and identified six defects, two of them critical.

The governing question for a document database is not *"what are the entities"* but **"what is always read and written together, and is it bounded?"**

## Decision

### 1. Aggregate roots and collections — 13 entities, 10 collections

| Entity | Persistence | Justification |
|---|---|---|
| User | 📦 Collection | Independent lifecycle; referenced everywhere |
| Client | 📦 Collection | Independent lifecycle |
| Project | 📦 Collection | The central aggregate root |
| **ProjectMember** | 🔗 **Embedded** in Project as `teamMembers[]` | Bounded (~3–10). Never queried alone. "Projects I belong to" is answered by a multikey index. A collection would add a lookup to every project read and buy nothing |
| **Milestone** | 🔗 **Embedded** in Project as `milestones[]` | Bounded (~5–15). Meaningless outside its project; always displayed with it. Reordering becomes one atomic update. Each carries its own `_id` so Tasks can reference it |
| Task | 📦 Collection | Up to 500 per project (NFR-16) — unbounded relative to a document. Queried independently on every dashboard |
| Deliverable | 📦 Collection | Own state machine; queried across projects |
| **DeliverableVersion** | 🔗 **Embedded** in Deliverable as `versions[]` | Bounded (typically 1–5); always read with the parent. **Append-only array membership is a structurally stronger guarantee of BR-06/BR-07 than a promise not to update rows** |
| File | ⚠️ **Split — see §2** | Growth characteristics differ by context |
| Comment | 📦 Collection | Unbounded per target; polymorphic parent; own pagination and visibility filtering |
| Notification | 📦 Collection | High volume; per-user read state |
| Activity | 📦 Collection | Highest volume; append-only; own indexes and retention concerns |
| ProjectTemplate | 📦 Collection | Independent lifecycle |

**Resulting collections (10):** `users` · `clients` · `projects` · `tasks` · `deliverables` · `projectFiles` · `comments` · `notifications` · `activities` · `projectTemplates`

Each collection removed also removes a model, a repository, a set of endpoints, and a test suite — material savings against a 6-day implementation budget.

### 2. File persistence is deliberately asymmetric

| Context | Persistence | Reason |
|---|---|---|
| Deliverable version files | 🔗 Embedded in the version | Bounded; immutable once approved; never read without the version |
| Task attachments | 🔗 Embedded in Task as `attachments[]` | Bounded — a handful per task |
| **Project files** | 📦 Collection `projectFiles` | **Unbounded** — a long project accumulates contracts, briefs, and assets indefinitely, and clients upload here too (BR-27). Requires its own listing, pagination, and permission surface |

**On the apparent inconsistency:** a single **`FileRef` value object** (`originalName`, `mimeType`, `sizeBytes`, `storageKey`, `uploadedBy`, `uploadedAt`) is used identically in all three contexts. The *structure* is uniform; only the storage location differs, and it differs because growth characteristics differ. This is consistency where it matters and pragmatism where it counts.

### 3. Milestone progress is computed on read

BR-08 requires computed progress. Two implementations were considered:

| Approach | Trade-off |
|---|---|
| **Compute on read** (chosen) | Cannot drift — correct by construction. Costs one indexed aggregation per request |
| Denormalized counters | O(1) reads, but **any write path that forgets to update them corrupts progress silently** |

At ≤1 000 projects, ≤500 tasks each, and ≤30 concurrent users, an indexed aggregation grouped by `milestoneId` sits well inside the 500 ms budget (NFR-13). It also honours BR-08's intent most literally: the value is never stored anywhere it could be wrong.

**Migration trigger:** adopt counters if the Administrator dashboard exceeds ~500 ms on realistic data. Measure before optimizing.

### 4. Unique constraints must be partial indexes 🔴

**BR-30 (soft delete) silently breaks every unique constraint.** A soft-deleted user's email still occupies the unique index — so the address can never be reused, and the system reports "email already in use" while showing no such user anywhere.

**Every unique index shall be a partial index conditioned on `deletedAt: null`.** This applies to `users.email`, `users.username`, and `clients.name`. Decided now because retrofitting means rebuilding indexes on live data.

### 5. Lifecycle states are three distinct fields

"Deactivated", "archived", and "deleted" have different semantics and must not collapse into one flag.

| Field | Meaning | Applies to |
|---|---|---|
| `isActive: boolean` | May authenticate | `users` only |
| `archivedAt: Date \| null` | Hidden from default lists, **read-only**, fully retrievable | `clients`, `projects` |
| `deletedAt: Date \| null` | Soft-deleted, excluded from queries, retained for history | All collections |

`deletedAt` alone represents deletion. A companion `isDeleted` boolean is rejected as redundant state that can drift from its own timestamp.

### 6. Cascade rules

| Event | Rule |
|---|---|
| Client archived | Projects untouched and accessible. Creating **new** projects for that client is blocked |
| Client deleted | Refused while it has non-deleted projects |
| Project archived | Everything beneath becomes read-only. No cascading write — archive is a view concern |
| Project deleted | **Cascade `deletedAt`** to milestones, tasks, deliverables, project files, comments, activities. MongoDB has no joins; filtering by parent state on every query is slower and easier to forget than one cascading write |
| Milestone deleted | Refused while non-cancelled tasks remain (FR-034) |
| Team member removed | Refused while they hold open tasks (FR-024) |
| **User deactivated** | **Refused while they hold non-`Done`, non-`Cancelled` tasks (BR-32, new in SRS v1.1)** |
| User deleted | Never hard-deleted. Authorship on tasks, comments, and activities is retained — anonymous history is worthless |
| Deliverable approved | Version array and its files become immutable (BR-07) |
| Task cancelled | Excluded from progress (BR-12). Comments and attachments retained |

### 7. Audit fields

| Field | Applies to |
|---|---|
| `createdAt`, `createdBy` | All collections |
| `updatedAt`, `updatedBy` | All **mutable** collections — **omitted on `activities`** |
| `deletedAt`, `deletedBy` | All soft-deletable collections |
| `archivedAt`, `archivedBy` | `clients`, `projects` |
| `isActive` | `users` |

Omitting `updatedAt`/`updatedBy` from `activities` is deliberate: a schema with no way to record a modification is a structure that cannot be modified, which is a stronger guarantee than a comment saying "do not update this."

### 8. Timestamps are stored in UTC

All timestamps are persisted as UTC. Conversion to `Africa/Casablanca` (NFR-05) happens only at the presentation layer. Due-date comparisons for *due soon* and *overdue* (BR-20) must evaluate the **day boundary in Casablanca**, not in UTC — Morocco shifts its offset around Ramadan, so this is not a once-yearly edge case.

### 9. Naming

- Collections: `camelCase` plural — `projectFiles`, `projectTemplates`
- Enums in code: `UPPER_SNAKE_CASE` — `IN_REVIEW`, `CHANGES_REQUESTED`, `ON_HOLD`
- **Task, Project, and Milestone status enums are three separate types** that happen to share the member name `IN_PROGRESS`. They shall never be unified — that would couple three independent state machines
- `Client` always means the organization. The role is `CLIENT_CONTACT`. `client` is never used for an HTTP client

## Consequences

### Positive

- Three fewer collections, with no loss of expressiveness
- BR-06 and BR-07 become structurally enforced rather than conventionally enforced
- The soft-delete/unique-index defect (§4) is prevented rather than discovered in production
- Cascade and audit behaviour is uniform and specified before any code exists
- Phase 4 begins from a settled model rather than an open one

### Negative

- Milestone reordering and team changes require updating the Project document, creating a contention point on that single document. Irrelevant at ≤30 concurrent users
- Milestones cannot be queried independently of their project. No requirement asks for that
- Progress aggregation runs per request until the migration trigger is met
- Embedded milestone `_id`s must be generated explicitly, since they are subdocuments rather than top-level documents

### Neutral

- `activities` and `notifications` grow without bound. Acceptable at this scale; a TTL index is the future answer, not a v1 feature

## Related Amendments

This review also produced three SRS v1.1 changes, approved separately by the Project Owner:

| Change | Rule |
|---|---|
| Explicit `POST /deliverables/:id/start-review`; no read operation changes state | **BR-31** |
| Deactivation refused while the user holds open tasks | **BR-32** |
| Unique immutable `username` for `@mentions` | **BR-33** |
