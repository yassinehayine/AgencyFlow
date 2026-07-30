# AgencyFlow — Requirements Traceability Matrix (RTM)

| Field | Value |
|---|---|
| **Document ID** | `04-Requirements-Traceability-Matrix` |
| **Project** | AgencyFlow |
| **Phase** | Phase 2 — Business Analysis |
| **Version** | **1.1** |
| **Date** | 2026-07-30 |
| **Author** | Senior Business Analyst |
| **Status** | **Approved — 2026-07-30. Living document from Phase 8.** |
| **Depends on** | `01-SRS`, `02-User-Stories`, `03-Use-Cases` |

---

## Document Control

| Version | Date | Author | Change |
|---|---|---|---|
| 1.0 | 2026-07-30 | Business Analyst | Initial matrix covering 80 FRs, 30 BRs, 35 NFRs, 65 stories, 32 use cases |
| **1.1** | 2026-07-30 | Architect | Realigned to SRS 1.1: **FR-081** and **BR-31 – BR-33** added; FR-008 and FR-010 amended; totals updated to **81 FRs / 33 BRs** |

| Role | Name | Decision | Date |
|---|---|---|---|
| Project Owner | Yassine | ☑ **Approved** | 2026-07-30 |

---

## 1. Purpose

The RTM answers four questions that no other document can:

| Question | Direction | Failure it prevents |
|---|---|---|
| Is every requirement realized and tested? | **Forward** | Requirements silently dropped during build |
| Does every piece of work exist for a stated reason? | **Backward** | Gold-plating — building things nobody asked for |
| What breaks if this requirement changes? | **Impact** | Blind change with unknown consequences |
| Which business problem does this code serve? | **Value** | Effort spent on things that solve nothing |

It satisfies engineering goal **EG-07** in `00-Project-Foundation.md`, and it is a **living document**: the Status column is updated as each requirement is implemented and tested, then reported in `12-Final-Project-Report.md`.

## 2. Identifier Scheme

| Prefix | Artefact | Document |
|---|---|---|
| `P-n` | Business problem | `01-SRS` §2.2 |
| `PG-nn` | Product goal | `01-SRS` §2.3 |
| `BR-nn` | Business rule | `01-SRS` §4 |
| `FR-nnn` | Functional requirement | `01-SRS` §7 |
| `NFR-nn` | Non-functional requirement | `01-SRS` §9 |
| `US-nnn` | User story | `02-User-Stories` |
| `UC-nn` | Use case | `03-Use-Cases` |
| `TC-nnn` | Test case | `10-Test-Plan-and-Report` (Phase 9) |

**Status values:** `Not Started` · `In Progress` · `Implemented` · `Tested` · `Deferred` · `Cancelled`.
All rows begin at `Not Started`; Phase 2 has produced no code.

---

## 3. Value Chain — Problem to Requirement

Every problem stated in discovery is answered by requirements. **No problem is unaddressed, and no module exists without a problem behind it.**

| Problem | Product Goal | Delivering modules | Key requirements |
|---|---|---|---|
| **P-1** Information scattered across Excel, WhatsApp, email, paper | **PG-01** One centralized system | M-3, M-4, M-5, M-6, M-7, M-8 | FR-013, FR-019, FR-029, FR-035, FR-045, FR-055 |
| **P-2** Fragmented communication | **PG-02** Conversation attached to the work | M-9, M-10 | FR-060, FR-062, FR-063, FR-066, FR-067 |
| **P-3** Tasks difficult to track | **PG-03** Task state always visible | M-6, M-11 | FR-038 – FR-044, FR-069, FR-070, FR-072 |
| **P-4** Clients lack visibility | **PG-04** Self-service client visibility | M-11 | FR-025, FR-033, FR-071, FR-073 |
| **P-4** ″ | **PG-06** Formal approval process | M-7 | FR-047 – FR-052 |
| **P-5** Manual coordination burden | **PG-05** Structured workflow, computed progress | M-5, M-6, M-11 | FR-031, FR-032, FR-040, FR-068, FR-069 |

**Coverage: 5 of 5 problems addressed. 6 of 6 product goals have implementing requirements.**

---

## 4. Forward Traceability — FR → Story → Use Case → Test

Priority: 🔴 Must · 🟡 Should · 🟢 Could

### M-1 · Authentication and Session

| FR | Requirement | Story | Use Case | Test | BR | Pri | Status |
|---|---|---|---|---|---|:--:|---|
| FR-001 | Authenticate with email + password | US-001 | UC-01 | TC-001 | BR-13 | 🔴 | Not Started |
| FR-002 | Issue 12-hour JWT | US-001 | UC-01 | TC-002 | BR-13 | 🔴 | Not Started |
| FR-003 | Enforce role authorization server-side | US-003 | *all* | TC-003 | BR-29 | 🔴 | Not Started |
| FR-004 | Log out | US-002 | UC-02 | TC-004 | — | 🔴 | Not Started |
| FR-005 | Change own password | US-004 | UC-03 | TC-005 | BR-13 | 🔴 | Not Started |
| FR-006 | Admin resets a password | US-005 | UC-08 | TC-006 | BR-13 | 🔴 | Not Started |
| FR-007 | No self-registration | US-003 | UC-01 | TC-007 | BR-11 | 🔴 | Not Started |

### M-2 · User Management

| FR | Requirement | Story | Use Case | Test | BR | Pri | Status |
|---|---|---|---|---|---|:--:|---|
| FR-008 | Create staff account with role, skill, **username** | US-006 | UC-04 | TC-008 | BR-02, BR-11, **BR-33** | 🔴 | Not Started |
| FR-009 | Edit user | US-007 | UC-04 | TC-009 | BR-02, BR-33 | 🔴 | Not Started |
| FR-010 | Deactivate user — **refused with open tasks** | US-008 | UC-05 | TC-010, **TC-081** | BR-30, **BR-32** | 🔴 | Not Started |
| FR-011 | List and filter users | US-009 | UC-04 | TC-011 | — | 🔴 | Not Started |
| FR-012 | Edit own profile | US-010 | UC-03 | TC-012 | — | 🟡 | Not Started |

### M-3 · Client Management

| FR | Requirement | Story | Use Case | Test | BR | Pri | Status |
|---|---|---|---|---|---|:--:|---|
| FR-013 | Create client organization | US-011 | UC-06 | TC-013 | BR-09 | 🔴 | Not Started |
| FR-014 | Edit client organization | US-011 | UC-06 | TC-014 | BR-09 | 🔴 | Not Started |
| FR-015 | List and search clients | US-011 | UC-06 | TC-015 | — | 🔴 | Not Started |
| FR-016 | Create client contact account | US-012 | UC-07 | TC-016 | BR-09, BR-11 | 🔴 | Not Started |
| FR-017 | List an organization's contacts | US-012 | UC-07 | TC-017 | BR-09 | 🔴 | Not Started |
| FR-018 | Archive client organization | US-013 | UC-06 | TC-018 | BR-30 | 🟡 | Not Started |

### M-4 · Project Management

| FR | Requirement | Story | Use Case | Test | BR | Pri | Status |
|---|---|---|---|---|---|:--:|---|
| FR-019 | Create project | US-014 | UC-09 | TC-019 | BR-03, BR-24 | 🔴 | Not Started |
| FR-020 | Edit project | US-015 | UC-09 | TC-020 | BR-25 | 🔴 | Not Started |
| FR-021 | Change project status | US-016 | UC-10 | TC-021 | — | 🔴 | Not Started |
| FR-022 | Reassign owning PM | US-017 | UC-12 | TC-022 | BR-24 | 🔴 | Not Started |
| FR-023 | Add team member | US-018 | UC-11 | TC-023 | BR-23 | 🔴 | Not Started |
| FR-024 | Remove team member | US-019 | UC-11 | TC-024 | BR-23 | 🔴 | Not Started |
| FR-025 | List projects scoped by role | US-020 | UC-30 | TC-025 | BR-10, BR-25, BR-26 | 🔴 | Not Started |
| FR-026 | Project detail filtered by permission | US-020 | UC-30 | TC-026 | BR-28 | 🔴 | Not Started |
| FR-027 | Archive project | US-021 | UC-10 | TC-027 | BR-30 | 🟡 | Not Started |
| FR-028 | Delete project (Admin, soft) | US-021 | UC-10 | TC-028 | BR-30 | 🟡 | Not Started |

### M-5 · Milestone Management

| FR | Requirement | Story | Use Case | Test | BR | Pri | Status |
|---|---|---|---|---|---|:--:|---|
| FR-029 | Create milestone | US-022 | UC-13 | TC-029 | — | 🔴 | Not Started |
| FR-030 | Edit milestone | US-023 | UC-13 | TC-030 | BR-08 | 🔴 | Not Started |
| FR-031 | Compute milestone status | US-024 | **UC-14** | TC-031 | BR-08, BR-12 | 🔴 | Not Started |
| FR-032 | Compute progress, excluding cancelled | US-024 | **UC-14** | TC-032 | BR-08, BR-12 | 🔴 | Not Started |
| FR-033 | List milestones with computed values | US-024 | UC-13 | TC-033 | BR-08 | 🔴 | Not Started |
| FR-034 | Delete milestone | US-025 | UC-13 | TC-034 | — | 🟡 | Not Started |

### M-6 · Task Management

| FR | Requirement | Story | Use Case | Test | BR | Pri | Status |
|---|---|---|---|---|---|:--:|---|
| FR-035 | Create task in milestone | US-026 | UC-15 | TC-035 | BR-03 | 🔴 | Not Started |
| FR-036 | Assign / reassign task | US-026, US-027 | UC-15 | TC-036 | BR-03, BR-23 | 🔴 | Not Started |
| FR-037 | Edit task | US-026 | UC-15 | TC-037 | — | 🔴 | Not Started |
| FR-038 | Assignee advances To Do → In Review | US-030, US-031 | UC-16 | TC-038 | BR-26 | 🔴 | Not Started |
| FR-039 | 🔒 Reject Team Member setting `Done` | US-032 | **UC-16** | **TC-039** | **BR-04** | 🔴 | Not Started |
| FR-040 | PM completes or returns task | US-033 | UC-17 | TC-040 | BR-04 | 🔴 | Not Started |
| FR-041 | Block task with mandatory reason | US-034 | UC-18 | TC-041 | BR-22 | 🔴 | Not Started |
| FR-042 | Cancel task | US-024 | UC-15 | TC-042 | BR-12 | 🔴 | Not Started |
| FR-043 | List and filter tasks | US-028 | UC-15 | TC-043 | BR-26, BR-28 | 🔴 | Not Started |
| FR-044 | Kanban board with drag-and-drop | US-029 | UC-15 | TC-044 | BR-04, BR-26 | 🟡 | Not Started |

### M-7 · Deliverable Management

| FR | Requirement | Story | Use Case | Test | BR | Pri | Status |
|---|---|---|---|---|---|:--:|---|
| FR-045 | Create deliverable | US-035 | UC-19 | TC-045 | — | 🔴 | Not Started |
| FR-046 | Attach files to a version | US-036 | UC-26 | TC-046 | BR-15 | 🔴 | Not Started |
| FR-047 | PM submits to client | US-037 | UC-20 | TC-047 | **BR-05** | 🔴 | Not Started |
| **FR-081** | Client explicitly starts review | US-038 | UC-21 | **TC-082** | **BR-31**, BR-10 | 🔴 | Not Started |
| FR-048 | Client approves | US-039 | UC-22 | TC-048 | BR-07, BR-10 | 🔴 | Not Started |
| FR-049 | Client requests changes | US-040 | UC-23 | TC-049 | BR-10 | 🔴 | Not Started |
| FR-050 | New version on resubmission | US-041 | UC-24 | TC-050 | **BR-06** | 🔴 | Not Started |
| FR-051 | Approved deliverable immutable | US-039 | UC-22 | TC-051 | **BR-07** | 🔴 | Not Started |
| FR-052 | List project deliverables | US-038 | UC-21 | TC-052 | BR-10 | 🔴 | Not Started |
| FR-053 | Link deliverable to tasks | US-035 | UC-19 | TC-053 | — | 🟡 | Not Started |
| FR-054 | Display version history | US-042 | UC-25 | TC-054 | BR-06 | 🟡 | Not Started |

### M-8 · File Management

| FR | Requirement | Story | Use Case | Test | BR | Pri | Status |
|---|---|---|---|---|---|:--:|---|
| FR-055 | Validate type and 20 MB limit server-side | US-043 | UC-26 | TC-055 | BR-15 | 🔴 | Not Started |
| FR-056 | Permission-checked download | US-044 | UC-27 | TC-056 | BR-10, BR-28 | 🔴 | Not Started |
| FR-057 | Task attachments | US-045 | UC-26 | TC-057 | BR-16, BR-28 | 🟡 | Not Started |
| FR-058 | Project files, incl. client upload | US-046 | UC-26 | TC-058 | BR-16, BR-27 | 🟡 | Not Started |
| FR-059 | Delete a file (soft) | US-045 | UC-26 | TC-059 | BR-07, BR-30 | 🟡 | Not Started |

### M-9 · Collaboration

| FR | Requirement | Story | Use Case | Test | BR | Pri | Status |
|---|---|---|---|---|---|:--:|---|
| FR-060 | Comment on a deliverable | US-047 | UC-28 | TC-060 | BR-14, BR-19 | 🔴 | Not Started |
| FR-061 | Display comments with author + time | US-047, US-050 | UC-28 | TC-061 | BR-28 | 🔴 | Not Started |
| FR-062 | 🔒 Internal-only task comments | US-048 | UC-28 | TC-062 | **BR-14** | 🟡 | Not Started |
| FR-063 | `@mention` generates notification | US-049 | UC-29 | TC-063 | BR-19 | 🟡 | Not Started |

### M-10 · Notifications and Activity Feed

| FR | Requirement | Story | Use Case | Test | BR | Pri | Status |
|---|---|---|---|---|---|:--:|---|
| FR-064 | Generate notifications for 7 event types | US-051 | UC-15, UC-20 | TC-064 | BR-17 | 🟡 | Not Started |
| FR-065 | Notification list, unread count, mark read | US-052 | UC-30 | TC-065 | BR-17 | 🟡 | Not Started |
| FR-066 | Record immutable activities with visibility flag | US-053 | UC-31 | TC-066 | BR-21 | 🟡 | Not Started |
| FR-067 | Activity feed filtered by viewer | US-053, US-054 | UC-31 | TC-067 | BR-21, BR-28 | 🟡 | Not Started |

### M-11 · Dashboards and Client Portal

| FR | Requirement | Story | Use Case | Test | BR | Pri | Status |
|---|---|---|---|---|---|:--:|---|
| FR-068 | Administrator dashboard | US-055 | UC-30 | TC-068 | — | 🔴 | Not Started |
| FR-069 | Project Manager dashboard | US-056 | UC-30 | TC-069 | BR-25 | 🔴 | Not Started |
| FR-070 | Team Member dashboard | US-057 | UC-30 | TC-070 | BR-26 | 🔴 | Not Started |
| FR-071 | Client Contact dashboard | US-059 | UC-30 | TC-071 | **BR-10** | 🔴 | Not Started |
| FR-072 | Due-soon / overdue computed on read | US-058 | UC-30 | TC-072 | **BR-20** | 🔴 | Not Started |
| FR-073 | Client portal usable on phone / tablet | US-060 | UC-30 | TC-073 | — | 🔴 | Not Started |

### M-12 · Search, Templates, Reporting, Workload

| FR | Requirement | Story | Use Case | Test | BR | Pri | Status |
|---|---|---|---|---|---|:--:|---|
| FR-074 | Permission-scoped global search | US-061 | UC-32 | TC-074 | BR-10, BR-25, BR-26 | 🟡 | Not Started |
| FR-075 | Manage project templates | US-062 | UC-13 | TC-075 | — | 🟢 | Not Started |
| FR-076 | Create project from template | US-063 | UC-09 | TC-076 | — | 🟢 | Not Started |
| FR-077 | Export project summary as PDF | US-064 | UC-30 | TC-077 | — | 🟢 | Not Started |
| FR-078 | Team workload view | US-065 | UC-30 | TC-078 | BR-28 | 🟢 | Not Started |

### M-13 · Cross-Cutting Security

| FR | Requirement | Story | Use Case | Test | BR | Pri | Status |
|---|---|---|---|---|---|:--:|---|
| FR-079 | 🔒 Scope every data operation by role and ownership | US-003, US-020 | *all* | **TC-079** | **BR-10** | 🔴 | Not Started |
| FR-080 | Validate all input at the API boundary | US-003 | *all* | TC-080 | — | 🔴 | Not Started |

---

## 5. Business Rule Coverage

Every business rule must be enforced by at least one requirement and verified by at least one test. **A rule with no implementing requirement is a rule that will not exist in the software.**

| BR | Rule (abbreviated) | Enforced by | Verified by | Risk if violated |
|---|---|---|---|---|
| BR-01 | Single tenant | *Architecture* — Phase 3 | — | Low |
| BR-02 | Role-based permissions; skill is data | FR-003, FR-008, FR-009 | TC-003, TC-008 | Medium |
| BR-03 | One assignee per task; one client per project | FR-019, FR-035, FR-036 | TC-019, TC-036 | Medium |
| BR-04 | 🔒 Team Member cannot set `Done` | **FR-039**, FR-040, FR-044 | **TC-039** | **High** — destroys the review control |
| BR-05 | 🔒 Only PM submits to client | **FR-047** | TC-047 | **High** — unreviewed work reaches the client |
| BR-06 | Change request creates a new version | **FR-050**, FR-054 | TC-050 | **High** — history lost, disputes unresolvable |
| BR-07 | Approved is final | **FR-051**, FR-048, FR-059 | TC-051 | **High** — acceptance record becomes untrustworthy |
| BR-08 | Milestone status computed | FR-030, FR-031, FR-032, FR-033 | TC-031, TC-032 | Medium |
| BR-09 | Client is an organization | FR-013, FR-016, FR-017 | TC-013, TC-016 | Medium |
| BR-10 | 🔒 **Client data isolation** | **FR-079**, FR-025, FR-048, FR-052, FR-056, FR-071, FR-074 | **TC-079**, TC-025, TC-056 | **Critical** — cross-client data exposure |
| BR-11 | No public registration | FR-007, FR-008, FR-016 | TC-007 | High |
| BR-12 | Cancelled excluded, blocked counted | **FR-032**, FR-042 | **TC-032** | Medium — milestones never complete |
| BR-13 | Email + password only | FR-001, FR-002, FR-005, FR-006 | TC-001, TC-002 | Medium |
| BR-14 | 🔒 Task comments internal-only | **FR-062**, FR-060 | **TC-062** | **High** — internal discussion leaks to client |
| BR-15 | File types and 20 MB limit | **FR-055**, FR-046 | TC-055 | Medium |
| BR-16 | Three file contexts | FR-046, FR-057, FR-058 | TC-046, TC-057, TC-058 | Low |
| BR-17 | In-app notifications only | FR-064, FR-065 | TC-064 | Low |
| BR-18 | No chat | *Scope exclusion* | — | Low |
| BR-19 | Flat comments with mentions | FR-060, FR-063 | TC-060, TC-063 | Low |
| BR-20 | Deadline alerts computed on read | **FR-072** | TC-072 | Medium — stale or missing alerts |
| BR-21 | Activity visibility flag | **FR-066**, FR-067 | TC-066, TC-067 | **High** — internal events leak to client |
| BR-22 | Blocked requires a reason | **FR-041** | TC-041 | Medium — invisible blockers return |
| BR-23 | Team membership precedes assignment | FR-023, FR-024, FR-036 | TC-023, TC-036 | Medium |
| BR-24 | One PM per project; Admin reassigns | FR-019, FR-022 | TC-022 | Medium |
| BR-25 | PM scoped to owned projects | FR-020, FR-025, FR-069, FR-074 | TC-020, TC-025 | High |
| BR-26 | Member views all, edits own | FR-025, FR-038, FR-043, FR-044 | TC-038, TC-043 | High |
| BR-27 | Clients upload project files | FR-058 | TC-058 | Low |
| BR-28 | 🔒 Clients cannot see internal data | FR-026, FR-043, FR-057, FR-061, FR-067, FR-078 | TC-026, TC-062 | **Critical** |
| BR-29 | Admin has all permissions, no override mechanism | FR-003 | TC-003 | Low |
| BR-30 | All deletions are soft | FR-010, FR-018, FR-027, FR-028, FR-059 | TC-010, TC-027 | Medium |
| BR-31 | No read operation changes state; `Under Review` is explicit | **FR-081** | **TC-082** | Medium — GET side effects, concurrency race |
| BR-32 | No deactivation while holding open tasks | **FR-010** | **TC-081** | Medium — permanently stuck milestones |
| BR-33 | Unique immutable `username` for mentions | FR-008, FR-009, FR-063 | TC-008, TC-063 | Medium — ambiguous mentions |

**Coverage: 31 of 33 business rules have implementing requirements.** BR-01 and BR-18 are structural — one is an architectural property (Phase 3), the other a scope exclusion. Neither is implementable as a feature, and both are correctly absent from the FR list.

### Security-critical rules

Six rules carry a **High** or **Critical** risk rating. These receive **dedicated, individually named test cases** in Phase 9 rather than incidental coverage:

| Rule | Test | What must be proven |
|---|---|---|
| **BR-10** | **TC-079** | A Client Contact substituting another organization's id in any request receives no data |
| **BR-28** | TC-026, TC-062 | No task, task comment, attachment, or internal activity is reachable by any client route |
| **BR-04** | **TC-039** | A direct API call from a Team Member setting `Done` is refused with 403 |
| **BR-05** | TC-047 | A Team Member cannot submit a deliverable by any route |
| **BR-07** | TC-051 | An approved deliverable resists every modification attempt |
| **BR-06** | TC-050 | Resubmission never overwrites a prior version's files |

---

## 6. Non-Functional Requirement Verification

An NFR with no verification method is an aspiration, not a requirement.

| NFR | Attribute | Verification method | Phase |
|---|---|---|---|
| NFR-01 – NFR-05 | Localization | Manual inspection of UI, dates, timezone | 9 |
| NFR-06 | English code / French UI | Code review; `fr.ts` exists and is the sole source of UI strings | 8, 9 |
| NFR-07, NFR-08 | Responsive; portal on mobile | Manual test at 375 px, 768 px, 1440 px | 9 |
| NFR-09 | Action feedback | Manual review of every mutating action | 9 |
| NFR-10 | Accessibility | `eslint-plugin-jsx-a11y` + keyboard-only walkthrough | 8, 9 |
| NFR-11 | Client needs no training | Walkthrough by someone unfamiliar with the system | 9 |
| NFR-12, NFR-13 | Page < 2 s, API < 500 ms | Browser dev tools timing on seeded data | 9 |
| NFR-14 – NFR-16 | Scale | Seeded dataset at stated volumes | 9 |
| NFR-17 | Pagination and indexes | Design review (Phase 4) + query inspection | 4, 9 |
| NFR-18, NFR-19 | bcrypt, 12-hour JWT | Unit test on hashing; token expiry test | 9 |
| NFR-20, NFR-21 | 🔒 Server-side authorization and isolation | **Integration tests calling the API directly, bypassing the UI** | 9 |
| NFR-22, NFR-24 | Input and upload validation | Integration tests with malformed and oversized payloads | 9 |
| NFR-23 | No internal error leakage | Inspection of error responses under forced failure | 9 |
| NFR-25 | No secrets committed | Repository scan; `.gitignore` review | 8 |
| NFR-26 | No critical vulnerabilities | `npm audit` in CI | 8, 9 |
| NFR-27, NFR-28 | Availability, backups | Documented as known limitations | 10, 11 |
| NFR-29 | Soft delete | Integration test confirming records persist after deletion | 9 |
| NFR-30 | Error handling | Code review; no `catch {}` | 8 |
| NFR-31, NFR-32 | Modularity, single rule source | Architecture review against Phase 3 module boundaries | 3, 8 |
| NFR-33 | Coding standards | ESLint zero-warnings in CI | 8 |
| NFR-34 | ≥ 70 % service coverage | Coverage report in CI | 9 |
| NFR-35 | Browser compatibility | Manual check on Chrome, Firefox, Edge, Safari | 9 |

**NFR-20 and NFR-21 deserve emphasis.** They can only be verified by tests that call the API directly. A test driven through the user interface proves the button is hidden — it proves nothing about whether the server would have refused the request. That distinction is the entire difference between an application that looks secure and one that is.

---

## 7. Backward Traceability — Gap and Orphan Analysis

### 7.1 Coverage checks

| Check | Result |
|---|---|
| FRs with at least one user story | **81 / 81** ✅ |
| FRs with at least one use case | **81 / 81** ✅ |
| FRs with at least one test case | **81 / 81** ✅ |
| User stories tracing to at least one FR | **65 / 65** ✅ |
| Use cases tracing to at least one FR | **32 / 32** ✅ |
| Business rules with an implementing FR | **31 / 33** — BR-01, BR-18 structural ✅ |
| NFRs with a verification method | **35 / 35** ✅ |
| Business problems addressed | **5 / 5** ✅ |
| Product goals with implementing FRs | **6 / 6** ✅ |

**No orphan requirements. No orphan stories. No gold-plating** — every story exists to satisfy a stated requirement, and every requirement traces back to a problem the Project Owner described in discovery.

### 7.2 Artefact totals

| Artefact | Count |
|---|---|
| Business problems | 5 |
| Product goals | 6 |
| Business rules | 33 |
| Functional requirements | 81 |
| Non-functional requirements | 35 |
| User stories | 65 (204 points) |
| Use cases | 32 (18 detailed, 14 brief) |
| Test cases planned | 82+ |
| Domain entities | 13 (**10 collections** — see ADR-0004) |
| Actors | 4 |

---

## 8. Impact Analysis Reference

For change control after the scope freeze. If a requirement changes, everything in its row must be re-examined.

| If this changes… | Re-examine |
|---|---|
| **BR-10** (client isolation) | FR-025, FR-048, FR-052, FR-056, FR-071, FR-074, FR-079 · UC-07, UC-21, UC-22, UC-27, UC-30 · the entire data-access layer |
| **BR-04** (PM-only Done) | FR-039, FR-040, FR-044 · UC-16, UC-17 · task state machine, Kanban drag rules |
| **BR-06 / BR-07** (versioning, immutability) | FR-050, FR-051, FR-054, FR-059 · UC-22, UC-24, UC-25 · deliverable model and file storage |
| **BR-08 / BR-12** (computed progress) | FR-031, FR-032, FR-033, FR-042 · UC-14 · every milestone display and both dashboards showing progress |
| **BR-23 / BR-24** (membership, ownership) | FR-019 – FR-026, FR-036 · UC-09, UC-11, UC-12, UC-15 · all project-scoped queries |
| **BR-14 / BR-21 / BR-28** (client visibility) | FR-026, FR-043, FR-057, FR-061, FR-062, FR-066, FR-067, FR-078 · UC-27, UC-28, UC-31 · every client-facing response |
| **Actor model** (roles) | The entire permission matrix, all guards, every dashboard, and all four document sets |

---

## 9. Delivery Tracking

Updated during Phase 8. Reported in `12-Final-Project-Report.md`.

| Priority | FRs | Stories | Points | Implemented | Tested | Deferred |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| 🔴 Must | 59 | 46 | 137 | 0 | 0 | 0 |
| 🟡 Should | 18 | 15 | 53 | 0 | 0 | 0 |
| 🟢 Could | 4 | 4 | 14 | 0 | 0 | 0 |
| **Total** | **81** | **65** | **204** | **0** | **0** | **0** |

### Vertical slice plan

| Slice | Stories | Points | FR range | Target |
|---|:--:|:--:|---|---|
| 1 — Access | 11 | 26 | FR-001 – FR-017, FR-079, FR-080 | Day 1–2 |
| 2 — Projects | 7 | 22 | FR-019 – FR-026 | Day 2–3 |
| 3 — Work | 11 | 30 | FR-029 – FR-043 | Day 3–4 |
| 4 — Delivery | 11 | 33 | FR-045 – FR-056, FR-060, FR-061 | Day 4–5 |
| 5 — Visibility | 6 | 26 | FR-068 – FR-073 | Day 6 |

### Recorded delivery risk

The Must set is **137 story points across 46 stories in 6 working days**. Slices 1–5 leave no allowance for debugging, deployment, or error. The 🟡 Should set (53 points) and 🟢 Could set (14 points) are at **material risk of non-delivery**.

Per the Project Owner's Option A decision on 2026-07-30, this risk is **accepted and documented rather than mitigated by cutting scope**. Any Should or Could requirement not implemented will be reported in `12-Final-Project-Report.md` as *specified, designed, and documented — not implemented*, with its full specification retained. That is a legitimate and defensible engineering outcome; a silently dropped requirement is not.

---

## END OF DOCUMENT

**Maintenance:** this matrix is updated in the same pull request as the code that changes a requirement's status. It is never updated retrospectively in a batch — a traceability matrix reconstructed after the fact is a work of fiction.
