# ADR-0005 — Per-Request User Revalidation

| | |
|---|---|
| **Status** | **Accepted** — 2026-08-01 |
| **Deciders** | Project Owner, Architect |
| **Resolves** | Conflict between FR-009 and the stateless-token design, raised during Slice 2 implementation |
| **Affects** | FR-002, FR-003, FR-009, FR-010, BR-10, BR-13, BR-29, BR-30, NFR-19, NFR-20, A-10 |
| **Amends** | `05-Software-Architecture.md` §11.3 · `08-Backend-Design.md` §3.3 |

---

## Context

The approved design builds the `AccessScope` from the verified JWT **and from nothing else** (`05-Software-Architecture.md` §11.3). The token carries `{ sub, role, clientId, iat, exp }` and lives for 12 hours (BR-13, NFR-19). That is the textbook stateless design, and it is what Slice 2 first implemented.

Implementing user administration exposed a conflict the design documents had not reconciled.

**The requirement it contradicts.** FR-009's acceptance criterion, restated in US-007, is explicit:

> Given I change a user's role, when they next make a request, then their permissions match the new role.

With `role` inside a 12-hour token, that is false. The change takes effect when the token expires — up to twelve hours later, or at the user's next login, whichever comes first.

**The security consequence, which matters more than the requirement.** The same staleness applies to `isActive`. FR-010 and US-008 exist so that a departing employee's access ends; BR-30 keeps their records while removing their entry. Under a purely stateless token:

- A **deactivated** employee keeps full working access until their token expires.
- A **soft-deleted** user does too.
- A **demoted** user keeps the permissions they were demoted out of.

In each case the Administrator who made the change has every reason to believe it took effect, because the interface says it did. A security control that silently applies up to twelve hours late is worse than one that is known to be absent: it produces false confidence.

This was raised as an open question at the end of Slice 2 rather than decided unilaterally, because closing it changes a rule the Project Owner had approved.

## Decision

**`JwtStrategy` re-reads the acting user on every authenticated request. The token establishes identity; the database decides permissions.**

Concretely:

1. The signature and expiry are verified as before. Nothing about token issuance changes.
2. `claims.sub` — the only claim now trusted — identifies the user.
3. The user is loaded by `_id`, filtered on `isActive: true` and `deletedAt: null`.
4. A miss throws `401`, whatever the cause: deactivated, deleted, or never existed. The three are indistinguishable to the caller.
5. The `AccessScope` is built from the **record**, not the claims. `claims.role` and `claims.clientId` are ignored entirely.

`AccessScope.fromClaims()` is renamed `AccessScope.forUser()`. The rename is deliberate: the old name would now describe something the method no longer does, and a misleading name on the load-bearing security primitive is a defect waiting to be reintroduced.

### Structural consequence

`JwtStrategy` lives in the core `AuthorizationModule`, and core must not depend on a feature module (`05-Software-Architecture.md` §7, rule R1). The dependency is therefore **inverted**:

```
core/authorization/authenticated-user.port.ts   declares AuthenticatedUserLookup
modules/users/users.repository.ts               implements it
modules/users/authenticated-user-lookup.module  binds the two (@Global)
```

Core declares the interface it needs; a feature satisfies it; the binding module is the single wire. The dependency arrow still points inwards. `AuthenticatedUserLookupModule` is the only `@Global()` module on the feature side, and it exports exactly one token — keeping `UsersModule` itself non-global, so its full surface is not silently exposed everywhere.

## Options Considered

| Option | FR-009 satisfied | Deactivation is immediate | Cost per request | Verdict |
|---|:--:|:--:|---|---|
| **Claims only** (previous) | ❌ | ❌ up to 12 h | 0 | Rejected — the security gap is the deciding factor |
| Shorter token (e.g. 15 min) + refresh | ⚠️ partial | ⚠️ up to 15 min | 0, plus a refresh endpoint | Rejected — narrows the window without closing it, and adds a refresh-token mechanism BR-13 explicitly excludes |
| Server-side session store | ✅ | ✅ | 1 read | Rejected — needs shared state the single-instance architecture does not have, and reintroduces the sessions BR-13 removed |
| Revocation blocklist | ⚠️ | ✅ for deactivation only | 1 read | Rejected — solves deactivation but not role change, at the same cost as the option that solves both |
| **Per-request revalidation** | ✅ | ✅ | **1 indexed `_id` read** | **Chosen** |

The comparison is what makes this straightforward: the blocklist and the session store both cost a read per request and each solves less than revalidation does. Once a lookup is being paid for, there is no reason to buy the partial version.

## Consequences

### Accepted cost

One indexed `_id` lookup per authenticated request. At the scale in NFR-13 — roughly 60 users, single agency — this is a sub-millisecond primary-key read against a document that is almost certainly in the working set. The `_id` index exists unconditionally; no new index is required.

Public routes pay nothing: `JwtAuthGuard` short-circuits on `@Public()` before the strategy runs, so the health probe and login are untouched. This matters for the platform health check, which polls continuously.

### What this buys

| Behaviour | Before | After |
|---|---|---|
| Role change takes effect | Next login, or ≤ 12 h | **Next request** |
| Deactivation ends access | ≤ 12 h | **Next request** |
| Soft delete ends access | ≤ 12 h | **Next request** |
| Client contact's `clientId` | From token | **From the record** — a forged or stale value cannot widen BR-10 |

### What does not change

- Token issuance, payload and 12-hour expiry (FR-002, BR-13). No refresh token, no server-side session.
- `AccessScope` remains the sole authorisation input, still built once per request, still never from a request body.
- The four-layer authorisation pipeline (`05-Architecture` §11.2) is unchanged in shape. Layer 1 now consults the database; layers 2–4 are untouched.

### New failure mode, accepted

The API now returns `401` if the database is unreachable, where it previously would have authorised the request and failed later in the handler. This is the correct direction — refusing when authorisation cannot be established beats proceeding on an assumption — and a request that needs the database was going to fail anyway.

### Verified

Against a running instance, with an unchanged, still-valid token:

| Change applied | Same token, next request |
|---|---|
| Administrator demoted to Team Member | `GET /users` → **200 becomes 403** |
| Account deactivated | **401** |
| Account soft-deleted | **401** |

Seven unit tests in `jwt.strategy.spec.ts` assert that the claims' `role` and `clientId` are ignored in favour of the record, and that a missing subject is refused without a database call. They are written to fail if the lookup is ever optimised away.
