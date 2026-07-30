# AgencyFlow — Frontend Blueprint

| Field | Value |
|---|---|
| **Document ID** | `09-Frontend-Design` |
| **Phase** | Phase 7 — Frontend Design |
| **Version** | 1.0 (Draft — pending approval) |
| **Date** | 2026-07-30 |
| **Author** | Senior Software Architect |
| **Status** | Awaiting stakeholder approval |
| **Scope** | **Concise blueprint** — architectural decisions only, no screen specifications |
| **Binding inputs** | `01-SRS` v1.1 · `05-Architecture` §13 · `07-UML-Design` · `08-Backend-Design` |

| Role | Name | Decision | Date |
|---|---|---|---|
| Project Owner | Yassine | ☐ Approved ☐ Changes requested | |

---

## 0. Scope

Same treatment as Phase 6: settle only what is **expensive to change later**. Screen layouts, visual design, copy, and component internals are decided during implementation.

**Deliberately excluded:** wireframes, mockups, screen-by-screen specifications, colour palettes, component prop tables.

---

## 1. Route Map

Two route trees, one SPA, one build (`05-Architecture` §5.2). Router: **React Router** with `createBrowserRouter` and nested layout routes.

### 1.1 Public

| Route | Notes |
|---|---|
| `/login` | The only unauthenticated route |
| `/` | Redirects by role: internal → `/app/dashboard`, Client Contact → `/portal/dashboard` |

### 1.2 Internal Workspace — `/app/*`

| Route | Roles | Notes |
|---|---|---|
| `/app/dashboard` | All internal | Shape varies by role (FR-068 – FR-070) |
| `/app/projects` | All internal | Scoped list (BR-25, BR-26) |
| `/app/projects/:projectId` | All internal | Tabbed: overview · milestones & tasks · board · deliverables · files · activity |
| `/app/projects/:projectId/tasks/:taskId` | All internal | Detail — rendered as a panel over the project view |
| `/app/deliverables/:deliverableId` | All internal | PM's submit/version workspace |
| `/app/clients` · `/app/clients/:clientId` | Admin, PM | PM read-only except contact creation |
| `/app/users` | **Admin only** | FR-008 – FR-011 |
| `/app/templates` | Admin, PM | 🟢 Could |
| `/app/search` | All internal | 🟡 Should |
| `/app/notifications` | All internal | 🟡 Should |
| `/app/profile` | All | — |

### 1.3 Client Portal — `/portal/*`

| Route | Notes |
|---|---|
| `/portal/dashboard` | Projects, progress, **deliverables awaiting my approval** |
| `/portal/projects/:projectId` | Progress, milestones, deliverables, shared files, client-visible activity |
| `/portal/deliverables/:deliverableId` | **The primary screen of the product** — review, start-review, approve, request changes, comment, version history |
| `/portal/profile` | — |

**The portal has no route to tasks, team, or internal activity.** BR-28 is expressed as an absent route tree, not as a hidden button.

### 1.4 The route-tree decision

Separate trees rather than one shared tree with conditional rendering. It gives the client portal its own layout, its own responsive baseline, and its own navigation — and it makes the security boundary visible in the URL. **It is not the security mechanism**; the API is (§8).

---

## 2. Layout Hierarchy

```
RootLayout                       error boundary · toaster · query client
├── AuthLayout                   centered card, no navigation
│   └── /login
├── AppLayout            [RequireAuth + RequireInternalRole]
│   ├── Sidebar          role-filtered navigation
│   ├── TopBar           search · notifications · user menu
│   └── <Outlet/>        page content
└── PortalLayout         [RequireAuth + RequireClientContact]
    ├── PortalHeader     logo · project switcher · user menu
    └── <Outlet/>        mobile-first content
```

| Layout | Navigation | Baseline |
|---|---|---|
| `AppLayout` | Persistent sidebar ≥1024 px; drawer below | Desktop-first, information-dense |
| `PortalLayout` | Minimal header, no sidebar | **Mobile-first**, low density, large tap targets |

`PortalLayout` is deliberately not a variant of `AppLayout`. The two serve different users with opposite density needs; forcing one shell to serve both produces a compromise that suits neither.

---

## 3. Component Architecture

### 3.1 Three tiers

| Tier | Location | Rule |
|---|---|---|
| **1 — UI primitives** | `components/ui/` | Button, Input, Select, Dialog, Badge… **No domain knowledge, no data fetching** |
| **2 — Shared composites** | `components/shared/` | DataTable, QueryBoundary, EmptyState, StatusBadge, FileUploader, ConfirmDialog, Avatar. Domain-aware, feature-agnostic |
| **3 — Feature components** | `features/<feature>/components/` | ProjectCard, TaskBoard, DeliverableTimeline. Owned by one feature |

**Dependencies point downward only: 3 → 2 → 1.** A UI primitive that imports a feature is a boundary violation, exactly as in the backend.

### 3.2 Folder structure

```
apps/web/src/
├── main.tsx · App.tsx · router.tsx
├── layouts/          RootLayout · AuthLayout · AppLayout · PortalLayout
├── components/
│   ├── ui/           tier 1
│   └── shared/       tier 2
├── features/         mirrors backend modules
│   ├── auth/         components · hooks · api
│   ├── projects/
│   ├── tasks/
│   ├── deliverables/
│   ├── clients/
│   ├── users/
│   ├── files/
│   ├── comments/
│   ├── notifications/
│   └── dashboard/
├── pages/
│   ├── app/          internal route components
│   └── portal/       client route components
├── lib/
│   ├── api-client.ts JWT attach · 401 handling · error normalization
│   ├── query-keys.ts key factory (§4.2)
│   └── format.ts     dates (dd/MM/yyyy, Africa/Casablanca)
├── hooks/            useAuth · useScopedNav · useMediaQuery
├── i18n/fr.ts        all user-facing strings
└── styles/           Tailwind config + tokens
```

**`features/` mirrors the backend module names.** A requirement's module locates both its API code and its UI code — the same navigational property the backend has.

### 3.3 Styling

**Tailwind CSS**, plus **Radix UI primitives** for Dialog, Dropdown, Select, Tabs, and Toast.

Tailwind removes class-naming overhead and ships mobile-first responsive utilities, which §7 depends on. Radix is adopted **only for the components that are genuinely hard to make accessible by hand** — focus trapping, escape handling, ARIA wiring, keyboard navigation. Hand-rolling an accessible modal is a classic multi-day detour, and NFR-10 requires keyboard operability. Everything else is plain Tailwind.

---

## 4. State Management

### 4.1 The split

| State | Tool | Examples |
|---|---|---|
| **Server state** | **TanStack Query** | Projects, tasks, deliverables, dashboards — everything owned by the API |
| **Session state** | React Context | Authenticated user, token, role |
| **UI state** | `useState` / `useReducer` | Modal open, active tab, form drafts |
| **URL state** | Router search params | Filters, pagination, sort — **shareable and back-button-correct** |

**No Redux, no Zustand.** Nearly all state here is server state; treating it as client state means hand-writing loading flags, error flags, refetching, and invalidation on every screen. A global store would hold the current user and almost nothing else.

### 4.2 Query key factory — decide now, not later

```ts
queryKeys.projects.all              // ['projects']
queryKeys.projects.list(filters)    // ['projects','list',filters]
queryKeys.projects.detail(id)       // ['projects','detail',id]
queryKeys.tasks.byProject(id)       // ['tasks','project',id]
```

All keys come from one factory; **no inline array literals**. Invalidation then works by prefix — `invalidateQueries(queryKeys.projects.all)` — and cannot miss a key someone spelled differently. Retrofitting this after fifty ad-hoc keys is a painful sweep, which is why it belongs in the blueprint.

### 4.3 Mutations and optimistic updates

Every mutation invalidates the affected key prefixes. Task status changes invalidate both the task list **and** the project (milestone progress is computed server-side, so a stale project view would show a stale percentage).

> **Optimistic updates are used only for trivially reversible, non-authoritative actions** — marking a notification read.
>
> **Never for state transitions.** The server owns every state machine (SM-1 – SM-4). An optimistic Kanban drag into `Done` would briefly show a Team Member that their task completed, before a `403` from BR-04 snapped it back. Showing a user an outcome the rules forbid is worse than a 200 ms delay.

### 4.4 Defaults

`staleTime` 30 s · retry once (not on 4xx) · no refetch on window focus for lists · `refetchOnMount` for dashboards.

---

## 5. Form Validation

**React Hook Form + Zod resolver.** Schemas colocated with their form.

### 5.1 The rule that prevents drift

> **Client-side validation covers shape only — required, length, format, enum. It never re-implements a business rule.**

The backend uses `class-validator`; the frontend uses Zod. Sharing runtime validators would mean putting a runtime dependency into `packages/contracts`, which ADR-0001 keeps type-only. So some *shape* duplication is unavoidable — but duplicating **business rules** would be a genuine defect, because two implementations of BR-04 or BR-23 will eventually disagree, and the client's copy will be the wrong one.

| Rule type | Where |
|---|---|
| "Title is required, 2–200 chars" | Both — Zod for instant feedback, DTO as the authority |
| "Assignee must be a project member" (BR-23) | **Server only.** The UI restricts the dropdown to team members as *convenience*; the server decides |
| "Only a PM may mark Done" (BR-04) | **Server only.** The UI hides the control; the server enforces it |

### 5.2 Server errors in forms

The API returns a French `message` and a stable `code` (`08-Backend-Design` §5). Field-level errors from `details[]` map onto form fields; rule violations (`422`) surface as a form-level alert. **API messages are displayed as received** — they are already French and already authoritative.

---

## 6. French UI Strings

All user-facing text lives in `src/i18n/fr.ts` — a nested `as const` object giving typed key access.

```ts
export const fr = {
  common:   { save: 'Enregistrer', cancel: 'Annuler', loading: 'Chargement…' },
  task:     { status: { TODO: 'À faire', IN_REVIEW: 'En revue', DONE: 'Terminé' } },
  portal:   { awaitingApproval: 'Livrables en attente de votre approbation' },
} as const;
```

| Rule | Reason |
|---|---|
| **No French literal in any component** | One place to review wording; the difference between a one-hour and a one-week i18n migration later (NFR-02) |
| Keys named by **meaning**, not by text | `task.status.DONE`, never `task.terminated` |
| **Enum values map through `fr`** | The API returns `IN_REVIEW`; the UI shows *En revue*. Never translate on the server |
| API error `message` displayed as received | Already French, already authoritative (§5.2) |
| Dates via `lib/format.ts` only | `dd/MM/yyyy`, `Africa/Casablanca` (NFR-04, NFR-05) |

---

## 7. Responsive Behaviour

**One breakpoint token set, two opposite strategies.**

| Surface | Strategy | Baseline | Below baseline |
|---|---|---|---|
| **Internal `/app`** | Desktop-first | ≥1024 px, information-dense | Degrades gracefully: sidebar → drawer, tables → stacked cards. Usable, not optimized |
| **Client Portal `/portal`** | **Mobile-first** | **375 px** | Enhances upward: wider layout, side-by-side panels ≥768 px |

**Why they differ.** Staff work at desks all day on dense screens. The Client Contact is an occasional, non-technical user most likely holding a phone (SRS §3, NFR-08, FR-073). Optimizing both for the same viewport would compromise both.

**Portal acceptance bar:** every client action — view progress, open a deliverable, read comments, start review, approve, request changes, upload a file — must be completable at 375 px with no horizontal scrolling (TC-073).

---

## 8. Frontend Access Control

> ### The governing rule
> **The frontend hides what a user may not do. The server decides what a user may do.**
> UI-level restriction is usability, never security (NFR-20). Every guard below can be bypassed with dev tools, and it does not matter, because the API refuses independently (SD-3, SD-8).

### 8.1 Route guards

| Guard | Behaviour |
|---|---|
| `RequireAuth` | No valid token → `/login`, preserving the intended destination |
| `RequireInternalRole` | Client Contact reaching `/app/*` → redirect to `/portal/dashboard` |
| `RequireClientContact` | Internal user reaching `/portal/*` → redirect to `/app/dashboard` |
| `RequireRole(...roles)` | e.g. `/app/users` is Admin only → 403 page |

### 8.2 Role-based navigation

Navigation is generated from a **single declarative config** — `{ path, label, icon, roles[] }` — filtered by the current role. Nothing is hard-coded per role in the sidebar, so adding a route means adding one entry rather than editing conditionals in three places.

### 8.3 API response handling

| Status | Frontend behaviour |
|---|---|
| `401` | Clear session, redirect to `/login` — the token expired (12 h) |
| `403` | Friendly "action not permitted" — usually means the UI is out of date, so **log it** |
| `404` | Not-found page. **Also what an out-of-scope resource returns** (BR-10) — the UI cannot and must not distinguish |
| `422` | Business rule violated — show the API's French message near the action |

---

## 9. Error and Loading States

### 9.1 Four states, always

Every data-driven view handles **loading · empty · error · success**. This is structural, not per-screen discipline: a shared `<QueryBoundary>` wraps a query result and renders the right branch, so forgetting a state is not possible by omission (NFR-09).

| State | Treatment |
|---|---|
| **Loading** | Skeletons matching the eventual layout — not centred spinners. Prevents layout shift |
| **Empty** | Explanatory copy + the primary action ("Aucun projet. Créer un projet") — never a blank panel |
| **Error** | Cause + retry button. Never a raw stack or status code |
| **Success** | The content |

Mutations: optimistic disable of the trigger, French toast on success, inline error on failure.

### 9.2 🔴 The Render cold start

`05-Architecture` AR-09: the free-tier backend sleeps after ~15 minutes idle, so the **first request can take 30–60 seconds**. Left unhandled, the login screen looks broken during a demonstration.

> **Required behaviour on the login screen:** if the first request exceeds ~5 seconds, replace the spinner with an honest message — *« Démarrage du serveur en cours, cela peut prendre jusqu'à une minute… »* — and do not time out before ~90 seconds.
>
> This is a two-line change that turns "the app is broken" into "the app is starting." It is the highest-value defensive detail in the entire frontend.

### 9.3 Global error boundary

`RootLayout` carries an error boundary that catches render crashes, shows a recovery screen, and never leaves a white page.

---

## 10. Design System Principles

Principles, not a visual specification.

| # | Principle |
|---|---|
| **1 — Tokens, not values** | Colour, spacing, radius, typography come from Tailwind theme tokens. No arbitrary hex or pixel values in components |
| **2 — One component per concept** | Exactly one `StatusBadge`, driven by an enum-to-style map. Never a second status pill in a different feature |
| **3 — Composition over configuration** | Prefer composable subcomponents to a component with fourteen boolean props |
| **4 — Accessible by default (NFR-10)** | Semantic HTML · every input labelled · visible focus rings · keyboard operability for all interactive elements · Radix for complex widgets · `eslint-plugin-jsx-a11y` in CI |
| **5 — Consistent status colour language** | One status↔colour mapping across board, lists, badges, and portal. A client seeing green must always read it as the same thing |
| **6 — Density follows audience** | Internal dense, portal spacious (§7) |
| **7 — Every action gives feedback** | Loading, success, or error — never silence (NFR-09) |
| **8 — Destructive actions confirm** | One `ConfirmDialog`, always naming the consequence. **Approving a deliverable confirms explicitly** — BR-07 makes it irreversible |

---

## 11. Deferred to Implementation

| Deferred | Must respect |
|---|---|
| Screen layouts and visual design | §2 layouts, §10 principles |
| Colour palette and typography scale | §10 tokens |
| Component props and internals | §3 tier rules |
| Exact skeleton shapes | §9 four-state rule |
| Chart or progress-bar rendering | §10 status colour language |
| Full `fr.ts` contents | §6 naming rules |
| Icon set | Consistency only |

**Non-negotiable regardless:** no French literals in components · no inline query keys · no business rules client-side · no optimistic state transitions · portal usable at 375 px · four states on every data view · UI restriction is never security.

---

## 12. Exit Criteria

- [x] Route map for both trees
- [x] Layout hierarchy and navigation structure
- [x] Three-tier component architecture and folder organization
- [x] State strategy: TanStack Query + Context + URL, with a key factory
- [x] Form validation strategy and the no-duplicated-business-rules rule
- [x] French string organization
- [x] Dual responsive strategy with acceptance bar
- [x] Route guards and role-based navigation
- [x] Error and loading strategy, including the cold-start mitigation
- [x] Design system principles
- [ ] **Project Owner approval**

---

## END OF PHASE 7 — DESIGN COMPLETE

All seven design phases are approved and documented. **Implementation (Phase 8) begins with Slice 1 — Access**: repository and tooling setup, core modules, `AccessScope`, auth, users, clients (`02-User-Stories` §2).
