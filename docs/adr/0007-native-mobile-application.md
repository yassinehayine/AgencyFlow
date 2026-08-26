# ADR-0007 — Native Mobile Application: React Native with Expo

| | |
|---|---|
| **Status** | **Accepted** — 2026-08-18 |
| **Deciders** | Host company (requirement), Project Owner |
| **Resolves** | Re-opens and reverses the mobile half of Q9 |
| **Affects** | `01-SRS.md` §10 · `05-Software-Architecture.md` §15 · FR-073, NFR-08 · BR-28 · `DEPLOYMENT.md` |
| **Supersedes** | The **"Native mobile applications — responsive web only"** exclusion in `01-SRS.md` §10 |

---

## Context

`01-Software-Requirements-Specification.md` §10 excludes native mobile applications explicitly:

```
| Native mobile applications | Q9 — responsive web only |
```

That exclusion was correct on its own terms and was implemented faithfully: FR-073 and NFR-08 require the Client Portal to be fully operable at a 375 px viewport, and Slice 6 delivered exactly that — a separate `/portal/*` route tree with its own mobile-first layout, verified against TC-073.

**The host company has since required a React Native application as part of the internship.** This is an external constraint on the deliverable, not a technical finding. The responsive portal remains correct and stays in place; a second client is added alongside it.

Recorded here rather than absorbed silently because `00-Project-Foundation.md` §13.6 is explicit: *"Do not silently deviate. Silent deviation is how documentation becomes fiction."* An SRS that excludes something the repository contains is worse than one that never mentioned it.

## Decision

**A React Native application, built with Expo, serving the Client Contact portal only.** It consumes the existing NestJS API without modification and shares `@agencyflow/contracts` with the API and the web client.

### Scope

| On mobile | Web desktop only |
|---|---|
| Authentication, session, password change | User and client-organisation administration |
| Client dashboard (FR-071) | Agency dashboards, team workload (FR-068 – FR-070) |
| Projects and milestone progress (FR-033) | Project, milestone and task authoring |
| Deliverables and version history (FR-052, FR-054) | Deliverable submission (BR-05) |
| **Approve / request changes** (FR-048, FR-049) | The task board — a client may not see it (BR-28) |
| Download a file (FR-056) | File upload |

The Client Contact is the right and only target, and the SRS says why:

> `01-SRS.md` §3, A-4 — *The Client Contact is the only external, low-frequency, low-technical-skill user, and the most likely to use a phone.*

Agency roles work with dense tables, long forms and drag-and-drop. Building those on a phone would dilute the effort without serving the user who needs it.

## Options Considered

| Option | iOS build without a Mac | Setup cost | Monorepo support | Native modules needed here |
|---|---|---|---|---|
| **Expo (managed)** | ✅ **EAS Build compiles in the cloud** | Minutes | SDK 50+ via `metro.config.js` | None beyond `expo-secure-store`, `expo-file-system` |
| React Native CLI | ❌ Requires macOS + Xcode | Android Studio, Xcode, Gradle | Manual | Same — no advantage |
| Capacitor / Cordova wrapper | ✅ | Low | n/a | **Not a native app** — fails the requirement |

**Expo is chosen.** The CLI would only justify itself for a native module Expo does not cover, and this scope needs none. The absence of a Mac is decisive rather than incidental: EAS Build is the only path to an iOS artefact here.

## Consequences

### What is reused, and what that buys

`@agencyflow/contracts` carries **zero runtime dependencies** (ADR-0001) — no `class-validator`, no `reflect-metadata`, only types and constants. It is therefore portable to React Native unchanged, and the mobile client shares the same enums, the same `DELIVERABLE_STATUS_TRANSITIONS` table, and the same `classifyDeadline` function as the other two surfaces.

The consequence worth stating: **renaming a contract field breaks the mobile build in CI**, exactly as it already breaks the web build. That is the compile-time guarantee the monorepo was adopted for (ADR-0001), now extended to a third consumer.

### What does not change

**The API is untouched.** Every endpoint the portal scope needs already exists and already admits `CLIENT_CONTACT` — verified decorator by decorator before this ADR was written. `AccessScope`, BR-10 and BR-28 apply identically to a request from a phone: the server cannot tell, and must not need to.

**CORS is irrelevant to this client.** A native application is not a browser and sends no `Origin`, so `CORS_ORIGIN` neither helps nor hinders it. Access control rests entirely on the bearer token, as it already did.

### What changes

**Token storage.** The web deliberately uses `sessionStorage` so nothing outlives the browser session. React Native has no such API, and `AsyncStorage` is plaintext readable on a rooted device. The mobile client uses **`expo-secure-store`** (iOS Keychain, Android Keystore).

This carries one deliberate behavioural difference: on mobile the session survives closing the app, up to the JWT's natural 12-hour expiry (BR-13). A phone application that logged the user out every time it was backgrounded would be unusable, and the token's lifetime — not the process lifetime — is what BR-13 actually bounds.

**Push notifications are out of scope.** There is no `notifications` module in the API; FR-064 is a *Should* story never implemented, and BR-17 states *"no email, no push"*. Delivering push would require building the notification domain first. The application refreshes on returning to the foreground instead.

### New risks

| # | Risk | Mitigation |
|---|---|---|
| **AR-12** | Metro resolves a second copy of React through the monorepo, producing an invalid-hook error that names nothing useful | `disableHierarchicalLookup` plus two explicit `nodeModulesPaths` in `metro.config.js` |
| **AR-13** | A device cannot reach `localhost`; every request fails with a bare "Network request failed" | API origin derived from the Metro host in development, `EXPO_PUBLIC_API_URL` in a build |
| **AR-14** | Expo SDK upgrades move faster than the rest of the stack | Versions pinned; the SDK is upgraded deliberately, never incidentally |

## Verification

Phase 1 proved the foundation rather than assuming it:

```
tsc --noEmit                       clean
tsc with a deliberate error        caught  (Property 'INVENTED_ROLE' does not exist
                                            on type '{ readonly ADMINISTRATOR: …}')
expo export --platform android     2.7 MB Hermes bundle produced
strings in the bundle              CLIENT_CONTACT · CHANGES_REQUESTED ·
                                   classifyDeadline · DUE_SOON  — all present
```

The negative test matters more than the positive one: a passing type-check proves declarations were *found*, not that Metro can *bundle* them. Those are different resolution mechanisms, and the monorepo symlink is exactly where the second one fails. The bundle inspection is what closes that gap — shared code is demonstrably inside the artefact that would ship.

## Documentation to amend

The SRS §10 exclusion and `05-Software-Architecture.md` §15 are amended in place with this ADR referenced, in the same manner as ADR-0006. The mobile architecture is documented in `10-Mobile-Design.md` once the application has screens to describe — writing it now would document intentions rather than a system.
