# AgencyFlow — User Stories

| Field | Value |
|---|---|
| **Document ID** | `02-User-Stories` |
| **Project** | AgencyFlow |
| **Phase** | Phase 2 — Business Analysis |
| **Version** | **1.1** |
| **Date** | 2026-07-30 |
| **Author** | Senior Business Analyst |
| **Status** | **Approved — 2026-07-30** |
| **Depends on** | `01-Software-Requirements-Specification.md` |

---

## Document Control

| Version | Date | Author | Change |
|---|---|---|---|
| 1.0 | 2026-07-30 | Business Analyst | Initial user story set derived from the approved requirement baseline |
| **1.1** | 2026-07-30 | Architect | Realigned to SRS 1.1 — US-006 (username), US-008 (deactivation guard), US-038 (explicit start-review). No new stories; point totals unchanged |

| Role | Name | Decision | Date |
|---|---|---|---|
| Project Owner | Yassine | ☑ **Approved** | 2026-07-30 |

---

## 1. Purpose and Method

This document restates the requirements of `01-SRS` as **user stories** — the form that drives implementation. Where the SRS says *what the system must do*, a user story says *who wants it and why*, and its acceptance criteria state *how we will know it works*.

### 1.1 Format

Every story follows:

> **As a** `<role>`, **I want** `<capability>`, **so that** `<business value>`.

Acceptance criteria use **Given / When / Then**, because that form is directly executable as a test case in Phase 9. A criterion that cannot be turned into a test is not a criterion.

### 1.2 Estimation

Story points use a modified Fibonacci scale (1, 2, 3, 5, 8) measuring **relative complexity**, not hours.

| Points | Meaning |
|---|---|
| **1** | Trivial. A single simple operation |
| **2** | Small. One entity, straightforward rules |
| **3** | Moderate. Multiple rules or cross-entity effects |
| **5** | Large. Complex logic, state transitions, or several layers |
| **8** | Very large. Should normally be split |

### 1.3 Global Definition of Done

Applies to **every** story in addition to its own criteria. Full definition in `00-Project-Foundation.md` §14.1.

- Authorization enforced **server-side**, never by hiding UI (NFR-20)
- Client data isolation respected where applicable (BR-10)
- Input validated at the API boundary (NFR-22)
- Error paths handled, not only the happy path
- Unit tests for new business logic
- UI strings in French, code in English (NFR-06)
- CI green; squash-merged to `main`

### 1.4 Index of Epics

| Epic | Title | Stories | Points |
|---|---|---|---|
| **EP-1** | Authentication and Account Access | US-001 – US-005 | 12 |
| **EP-2** | User and Client Administration | US-006 – US-013 | 19 |
| **EP-3** | Project Setup and Team | US-014 – US-021 | 25 |
| **EP-4** | Planning: Milestones and Tasks | US-022 – US-029 | 25 |
| **EP-5** | Task Execution | US-030 – US-034 | 12 |
| **EP-6** | Deliverables and Client Approval | US-035 – US-042 | 26 |
| **EP-7** | File Exchange | US-043 – US-046 | 12 |
| **EP-8** | Collaboration | US-047 – US-050 | 12 |
| **EP-9** | Awareness | US-051 – US-054 | 16 |
| **EP-10** | Dashboards and Client Portal | US-055 – US-060 | 26 |
| **EP-11** | Productivity Tools | US-061 – US-065 | 19 |
| | **Total** | **65 stories** | **204 points** |

---

## EP-1 · Authentication and Account Access

### US-001 — Log in 🔴

> **As** any user, **I want** to log in with my email and password, **so that** I can access the information relevant to my role.

**Traces to:** FR-001, FR-002 · **Points:** 3

- **Given** I am registered and active, **when** I submit correct credentials, **then** I am authenticated and taken to my role's dashboard.
- **Given** I submit an incorrect password, **when** I attempt to log in, **then** I see a generic failure message that does not reveal whether the email exists.
- **Given** my account is deactivated, **when** I submit correct credentials, **then** I am refused access.
- **Given** I am authenticated, **when** 12 hours pass, **then** my session expires and I must log in again.

### US-002 — Log out 🔴

> **As** any user, **I want** to log out, **so that** nobody else can use my session on a shared computer.

**Traces to:** FR-004 · **Points:** 1

- **Given** I am logged in, **when** I log out, **then** my session is discarded and protected pages are no longer reachable.

### US-003 — Be denied what my role does not permit 🔴

> **As** the agency, **I want** every action checked on the server against the requester's role, **so that** permissions cannot be bypassed by manipulating the browser.

**Traces to:** FR-003, FR-079, NFR-20 · **Points:** 5

- **Given** I am a Team Member, **when** I call an administrator-only operation directly, **then** the server refuses it with 403 regardless of what my interface shows.
- **Given** I am a Client Contact, **when** I request a project belonging to another organization, **then** the server refuses; no data is returned.

### US-004 — Change my password 🔴

> **As** any user, **I want** to change my own password, **so that** I control my account's security.

**Traces to:** FR-005 · **Points:** 2

- **Given** I supply my current password correctly and a new password of at least 8 characters, **when** I confirm, **then** the change succeeds and the new password works on next login.
- **Given** I supply an incorrect current password, **when** I confirm, **then** the change is refused.

### US-005 — Have my password reset by the Administrator 🔴

> **As** a user who has forgotten my password, **I want** the Administrator to reset it, **so that** I can regain access without a self-service email flow.

**Traces to:** FR-006, BR-13 · **Points:** 1

- **Given** I am the Administrator, **when** I set a new password for a user, **then** it takes effect immediately and no email is sent.

---

## EP-2 · User and Client Administration

### US-006 — Create a staff account 🔴

> **As** an Administrator, **I want** to create accounts for agency staff with a role and skill, **so that** the team can access the platform.

**Traces to:** FR-008, BR-02, BR-11, BR-33 · **Points:** 3

- **Given** I supply name, unique email, unique username, and role, **when** I save, **then** the account is created and can log in.
- **Given** an account exists, **when** I edit it, **then** the username cannot be changed — it is immutable (BR-33).
- **Given** the role is Team Member, **when** I save without a skill, **then** the form is refused — skill is mandatory for that role only.
- **Given** the email already exists, **when** I save, **then** creation is refused with a clear message.

### US-007 — Edit a user 🔴

> **As** an Administrator, **I want** to change a user's name, role, or skill, **so that** the system reflects staff changes.

**Traces to:** FR-009 · **Points:** 2

- **Given** I change a user's role, **when** they next make a request, **then** their permissions match the new role.

### US-008 — Deactivate a user 🔴

> **As** an Administrator, **I want** to deactivate a departing employee's account, **so that** access ends without erasing their work history.

**Traces to:** FR-010, BR-30, BR-32 · **Points:** 2

- **Given** the user still holds tasks that are neither `Done` nor `Cancelled`, **when** I deactivate them, **then** the system refuses and lists those tasks so I can reassign them first (BR-32).
- **Given** a user is deactivated, **when** they try to log in, **then** access is refused.
- **Given** a user is deactivated, **when** I open their past tasks and comments, **then** the records remain intact and attributed.
- **Given** they are the last active Administrator, **when** I try to deactivate them, **then** the system refuses (A-10).

### US-009 — Browse and filter users 🔴

> **As** an Administrator, **I want** to list and filter users by role, skill, and status, **so that** I can manage a growing team.

**Traces to:** FR-011 · **Points:** 2

- **Given** more users than fit one page, **when** I open the list, **then** results are paginated.
- **Given** I filter by role and skill together, **when** I apply, **then** only users matching both appear.

### US-010 — Edit my own profile 🟡

> **As** any user, **I want** to update my own name and password, **so that** my profile stays accurate.

**Traces to:** FR-012 · **Points:** 2

- **Given** I am editing my profile, **when** I try to change my own role or skill, **then** those fields are not available to me.

### US-011 — Register a client organization 🔴

> **As** an Administrator, **I want** to create a Client organization, **so that** projects can be attached to a real client.

**Traces to:** FR-013, BR-09 · **Points:** 2

- **Given** I supply a unique organization name, **when** I save, **then** the client is created and selectable when creating a project.
- **Given** the name already exists, **when** I save, **then** creation is refused.

### US-012 — Create a client contact account 🔴

> **As** an Administrator or Project Manager, **I want** to create a login for a person at a client organization, **so that** they can follow their projects themselves.

**Traces to:** FR-016, BR-09, BR-11 · **Points:** 3

- **Given** I create a contact, **when** I save, **then** the account has role Client Contact and is linked to exactly one organization.
- **Given** the contact logs in, **when** they view projects, **then** they see only their own organization's projects.

### US-013 — Archive a client organization 🟡

> **As** an Administrator, **I want** to archive a client we no longer work with, **so that** my lists stay relevant without losing history.

**Traces to:** FR-018, BR-30 · **Points:** 3

- **Given** a client is archived, **when** I open the default client list, **then** they are hidden but retrievable via a filter.
- **Given** a client is archived, **when** I open their past projects, **then** the projects and their history remain accessible.

---

## EP-3 · Project Setup and Team

### US-014 — Create a project 🔴

> **As** an Administrator or Project Manager, **I want** to create a project for a client, **so that** all its work lives in one place instead of Excel and WhatsApp.

**Traces to:** FR-019, BR-03, BR-24 · **Points:** 3

- **Given** I supply name, client, owning Project Manager, start date, and end date, **when** I save, **then** the project is created with status `Planned`.
- **Given** the end date precedes the start date, **when** I save, **then** creation is refused.
- **Given** I am a Project Manager, **when** I create a project, **then** I may assign myself or another PM as owner, and only an Administrator can later change it.

### US-015 — Edit a project I own 🔴

> **As** a Project Manager, **I want** to edit my own projects, **so that** details stay accurate as the engagement evolves.

**Traces to:** FR-020, BR-25 · **Points:** 2

- **Given** I own the project, **when** I edit it, **then** the change is saved.
- **Given** I do **not** own the project, **when** I attempt to edit it, **then** the server refuses.

### US-016 — Move a project through its lifecycle 🔴

> **As** a Project Manager, **I want** to change my project's status, **so that** everyone can see whether it is planned, running, paused, finished, or abandoned.

**Traces to:** FR-021 · **Points:** 3

- **Given** a project is `Planned`, **when** I set it to `In Progress`, **then** the change is saved and recorded as a client-visible activity.
- **Given** a project is `Completed`, **when** I attempt to set it back to `In Progress`, **then** the transition is refused per the state model.
- **Given** a project is put `On Hold`, **when** the client views it, **then** they see the status.

### US-017 — Reassign a project's manager 🔴

> **As** an Administrator, **I want** to change which Project Manager owns a project, **so that** work continues when someone leaves or is reassigned.

**Traces to:** FR-022, BR-24 · **Points:** 3

- **Given** I reassign the PM, **when** the new PM logs in, **then** the project appears in their list.
- **Given** I reassign the PM, **when** the previous PM logs in, **then** the project no longer appears and they cannot edit it.
- **Given** I am a Project Manager, **when** I attempt to reassign ownership, **then** the server refuses.

### US-018 — Build a project team 🔴

> **As** a Project Manager, **I want** to add Team Members to my project, **so that** I can assign them work.

**Traces to:** FR-023, BR-23 · **Points:** 3

- **Given** a user has role Team Member, **when** I add them, **then** they become a project member and the project appears in their list.
- **Given** a user is already a member, **when** I add them again, **then** the duplicate is refused.
- **Given** a user is a Client Contact, **when** I try to add them to a team, **then** it is refused.

### US-019 — Remove someone from a project team 🔴

> **As** a Project Manager, **I want** to remove a member from my project, **so that** access matches who is actually working on it.

**Traces to:** FR-024 · **Points:** 3

- **Given** the member has no open tasks, **when** I remove them, **then** they lose access to the project.
- **Given** the member still has non-cancelled, non-done tasks, **when** I remove them, **then** the system refuses and tells me to reassign those tasks first.

### US-020 — See only the projects that concern me 🔴

> **As** any user, **I want** my project list scoped to my role, **so that** I am not shown work that is not mine and clients never see each other.

**Traces to:** FR-025, BR-10, BR-25, BR-26 · **Points:** 5

- **Given** I am an Administrator, **when** I open projects, **then** I see all of them.
- **Given** I am a Project Manager, **when** I open projects, **then** I see only projects I own.
- **Given** I am a Team Member, **when** I open projects, **then** I see only projects I am a member of.
- **Given** I am a Client Contact, **when** I open projects, **then** I see only my own organization's projects — and substituting another organization's project id in the request returns no data.

### US-021 — Archive a finished project 🟡

> **As** a Project Manager, **I want** to archive a completed project, **so that** my active list stays useful.

**Traces to:** FR-027, BR-30 · **Points:** 3

- **Given** a project is archived, **when** I view the default list, **then** it is hidden but retrievable.
- **Given** a project is archived, **when** anyone opens it, **then** it is read-only.

---

## EP-4 · Planning: Milestones and Tasks

### US-022 — Plan a project in milestones 🔴

> **As** a Project Manager, **I want** to break my project into ordered milestones, **so that** the roadmap is clear to my team and the client.

**Traces to:** FR-029 · **Points:** 3

- **Given** I supply a name, description, due date, and order, **when** I save, **then** the milestone appears in the project's roadmap in the correct position.

### US-023 — Edit a milestone 🔴

> **As** a Project Manager, **I want** to adjust a milestone's details, **so that** the plan reflects reality.

**Traces to:** FR-030, BR-08 · **Points:** 2

- **Given** I open a milestone for editing, **when** I look for a status field, **then** there is none — status is computed and cannot be set by hand.

### US-024 — See milestone progress calculated for me 🔴

> **As** a Project Manager, **I want** milestone status and progress computed automatically from tasks, **so that** I stop maintaining progress by hand and it can never be wrong.

**Traces to:** FR-031, FR-032, BR-08, BR-12 · **Points:** 5

- **Given** a milestone has 10 tasks and 4 are `Done`, **when** I view it, **then** progress reads 40 %.
- **Given** 2 of those 10 tasks are `Cancelled` and 4 of the remaining 8 are `Done`, **when** I view it, **then** progress reads 50 % — cancelled tasks are excluded from both sides of the calculation.
- **Given** every non-cancelled task is `Done`, **when** the last one is marked `Done`, **then** the milestone becomes `Completed` automatically.
- **Given** a task is `Blocked`, **when** I view the milestone, **then** the blocked task still counts in the total and prevents completion.
- **Given** a milestone has no non-cancelled tasks, **when** I view it, **then** progress reads 0 % and nothing divides by zero.

### US-025 — Delete an unused milestone 🟡

> **As** a Project Manager, **I want** to delete a milestone I no longer need, **so that** the roadmap stays clean.

**Traces to:** FR-034 · **Points:** 2

- **Given** the milestone contains non-cancelled tasks, **when** I delete it, **then** the system refuses and explains why.

### US-026 — Create a task 🔴

> **As** a Project Manager, **I want** to create a task inside a milestone and assign it, **so that** work is explicitly owned instead of agreed verbally.

**Traces to:** FR-035, FR-036, BR-03, BR-23 · **Points:** 3

- **Given** I supply title, description, assignee, and due date, **when** I save, **then** the task is created with status `To Do`.
- **Given** the chosen assignee is not a member of the project team, **when** I save, **then** the system refuses.
- **Given** I am a Team Member, **when** I attempt to create a task, **then** the server refuses.

### US-027 — Reassign a task 🔴

> **As** a Project Manager, **I want** to move a task to a different Team Member, **so that** I can rebalance work.

**Traces to:** FR-036 · **Points:** 2

- **Given** I reassign a task, **when** the new assignee opens their dashboard, **then** the task appears there and no longer on the previous assignee's.

### US-028 — Find tasks quickly 🔴

> **As** a Project Manager or Team Member, **I want** to filter a project's tasks by status, assignee, and milestone, **so that** I can answer "what is blocked?" or "what is Amine doing?" immediately.

**Traces to:** FR-043, BR-26 · **Points:** 3

- **Given** I am a Team Member of the project, **when** I open the task list, **then** I can see all its tasks, not only my own.
- **Given** I am a Client Contact, **when** I attempt to view tasks, **then** access is refused — tasks are internal (BR-28).

### US-029 — Work the board 🟡

> **As** a Project Manager or Team Member, **I want** a Kanban board of the project's tasks grouped by status, **so that** I can see and move the flow of work at a glance.

**Traces to:** FR-044 · **Points:** 5

- **Given** I open the board, **when** it loads, **then** tasks appear in columns by status.
- **Given** I am a Team Member, **when** I try to drag a card that is not assigned to me, **then** the card is not draggable.
- **Given** I am a Team Member, **when** I drag my own card into `Done`, **then** the move is refused — only a PM can mark work done (BR-04).

---

## EP-5 · Task Execution

### US-030 — Start work on my task 🔴

> **As** a Team Member, **I want** to move my task to `In Progress`, **so that** the team knows I have picked it up.

**Traces to:** FR-038, BR-26 · **Points:** 2

- **Given** a task assigned to me is `To Do`, **when** I start it, **then** its status becomes `In Progress`.
- **Given** a task is assigned to someone else, **when** I attempt to change it, **then** the server refuses.

### US-031 — Submit my work for review 🔴

> **As** a Team Member, **I want** to move my finished task to `In Review`, **so that** my Project Manager can verify it.

**Traces to:** FR-038 · **Points:** 2

- **Given** my task is `In Progress`, **when** I submit it, **then** it becomes `In Review` and appears in my PM's review queue.

### US-032 — Be prevented from marking my own work done 🔴

> **As** the agency, **I want** only Project Managers to mark tasks `Done`, **so that** completed work is always verified by someone other than its author.

**Traces to:** FR-039, BR-04 · **Points:** 3

- **Given** I am a Team Member, **when** I attempt to set any task to `Done` — through the interface or by calling the API directly — **then** the server refuses with 403.
- **Given** I am the Project Manager, **when** I mark an `In Review` task `Done`, **then** it succeeds and milestone progress recomputes.

### US-033 — Send work back 🔴

> **As** a Project Manager, **I want** to return an unsatisfactory task to `In Progress`, **so that** it is corrected before it reaches the client.

**Traces to:** FR-040 · **Points:** 2

- **Given** a task is `In Review`, **when** I return it, **then** it becomes `In Progress` and the assignee is notified.
- **Given** a task is `To Do`, **when** I try to mark it `Done`, **then** it is refused — only `In Review` tasks may be completed.

### US-034 — Flag a blockage with a reason 🔴

> **As** a Team Member or Project Manager, **I want** to mark a task `Blocked` and say why, **so that** stalled work is visible instead of silently forgotten.

**Traces to:** FR-041, BR-22 · **Points:** 3

- **Given** I mark a task `Blocked`, **when** I leave the reason empty or blank, **then** the system refuses.
- **Given** I supply a reason, **when** I save, **then** the task shows as `Blocked` with the reason visible on the PM dashboard.
- **Given** the blockage is resolved, **when** I unblock the task, **then** it returns to `To Do` or `In Progress`.

---

## EP-6 · Deliverables and Client Approval

### US-035 — Create a deliverable 🔴

> **As** a Project Manager, **I want** to create a deliverable with a name, description, and due date, **so that** the client has a clearly identified output to review.

**Traces to:** FR-045 · **Points:** 3

- **Given** I supply the details, **when** I save, **then** the deliverable is created with status `Draft` and is not yet visible to the client as reviewable.

### US-036 — Attach the work 🔴

> **As** a Project Manager, **I want** to attach files to a deliverable, **so that** the client can actually see what was produced.

**Traces to:** FR-046, FR-055, BR-15 · **Points:** 3

- **Given** I upload an accepted file type under 20 MB, **when** I save, **then** it is attached to the current version.
- **Given** I upload a `.mp4` or a 40 MB file, **when** I save, **then** it is refused with a message stating the reason.

### US-037 — Submit a deliverable to the client 🔴

> **As** a Project Manager, **I want** to submit a deliverable to the client, **so that** the approval process starts formally instead of by email.

**Traces to:** FR-047, BR-05 · **Points:** 3

- **Given** the deliverable has at least one file, **when** I submit it, **then** its status becomes `Submitted` and it appears on the client's dashboard as awaiting review.
- **Given** the deliverable has no files, **when** I submit it, **then** submission is refused.
- **Given** I am a Team Member, **when** I attempt to submit, **then** the server refuses (BR-05).

### US-038 — Review what the agency sent me 🔴

> **As** a Client Contact, **I want** to open a submitted deliverable and see its files and description, **so that** I can judge the work.

**Traces to:** FR-052, FR-056, FR-081, BR-10, BR-31 · **Points:** 3

- **Given** a deliverable of my organization is `Submitted`, **when** I open it, **then** I see its description, files, and history, **and its status is unchanged** — opening a record never changes it (BR-31).
- **Given** I have opened a submitted deliverable, **when** I press "Start review", **then** its status becomes `Under Review` and my Project Manager can see I have taken it up.
- **Given** I prefer to decide immediately, **when** I approve or request changes from `Submitted`, **then** it succeeds without passing through `Under Review` (A-14).
- **Given** a colleague at my organization has already started the review, **when** I press "Start review", **then** nothing breaks — it is a no-op, not an error.
- **Given** a deliverable belongs to another organization, **when** I request it directly by id, **then** access is refused.

### US-039 — Approve a deliverable 🔴

> **As** a Client Contact, **I want** to approve a deliverable, **so that** the agency has a formal, recorded acceptance.

**Traces to:** FR-048, BR-07 · **Points:** 3

- **Given** a deliverable is under my review, **when** I approve it, **then** its status becomes `Approved` with my name and the date recorded.
- **Given** a deliverable is `Approved`, **when** I or anyone attempts to modify, delete, or un-approve it, **then** it is refused (BR-07).

### US-040 — Request changes 🔴

> **As** a Client Contact, **I want** to request changes and explain what is wrong, **so that** the agency knows exactly what to correct.

**Traces to:** FR-049 · **Points:** 3

- **Given** a deliverable is under my review, **when** I request changes with a comment, **then** its status becomes `Changes Requested` and the Project Manager sees it.
- **Given** I leave the comment empty, **when** I submit the change request, **then** it is refused — a rejection without a reason is useless to the agency.

### US-041 — Revise and resubmit without losing history 🔴

> **As** a Project Manager, **I want** resubmission after a change request to create a new version, **so that** the full negotiation history is preserved and nothing is silently overwritten.

**Traces to:** FR-050, BR-06 · **Points:** 5

- **Given** a deliverable is `Changes Requested`, **when** I attach corrected files and resubmit, **then** a new version is created and the previous version's files remain untouched.
- **Given** several rounds have occurred, **when** I open the deliverable, **then** every version is listed in order with its date and outcome.

### US-042 — Read the version history 🟡

> **As** any permitted user, **I want** to browse a deliverable's version history, **so that** I can see how the work evolved and what was said at each round.

**Traces to:** FR-054 · **Points:** 3

- **Given** a deliverable has three versions, **when** I open its history, **then** I see all three with their files, dates, and outcomes.
- **Given** I am a Client Contact, **when** I open a history, **then** it is only ever my own organization's deliverable.

---

## EP-7 · File Exchange

### US-043 — Upload safely 🔴

> **As** the agency, **I want** every upload validated on the server for type and size, **so that** the platform is not used to store or distribute unexpected content.

**Traces to:** FR-055, NFR-24, BR-15 · **Points:** 3

- **Given** a file of a permitted type under 20 MB, **when** it is uploaded, **then** it is accepted.
- **Given** a file renamed to `.pdf` but of another type, **when** it is uploaded, **then** validation does not rely solely on the client-declared type.

### US-044 — Download only what I may see 🔴

> **As** the agency, **I want** every download authorized on the server, **so that** knowing a file's URL never grants access.

**Traces to:** FR-056, BR-10 · **Points:** 3

- **Given** I am a Client Contact, **when** I request a file belonging to another organization by direct URL, **then** access is refused.

### US-045 — Attach work in progress to a task 🟡

> **As** a Team Member, **I want** to attach files to my task, **so that** intermediate work is shared with the team without leaving the platform.

**Traces to:** FR-057, BR-28 · **Points:** 3

- **Given** I attach a file to a task, **when** a Client Contact views the project, **then** the attachment is not visible to them in any form.

### US-046 — Exchange project documents with the agency 🟡

> **As** a Client Contact, **I want** to upload briefs and brand assets to my project, **so that** the agency has what it needs without an email thread.

**Traces to:** FR-058, BR-27 · **Points:** 3

- **Given** I am a Client Contact, **when** I upload a file to my own organization's project, **then** it is stored as a Project File and internal staff can see it.
- **Given** I am a Team Member, **when** I open Project Files, **then** I can view and download but not upload.

---

## EP-8 · Collaboration

### US-047 — Discuss a deliverable with the client 🔴

> **As** a Project Manager or Client Contact, **I want** to comment on a deliverable, **so that** the conversation about the work stays attached to the work.

**Traces to:** FR-060, FR-061, BR-14, BR-19 · **Points:** 3

- **Given** I post a comment, **when** anyone permitted opens the deliverable, **then** they see it with my name and timestamp, in chronological order.
- **Given** I am a Client Contact, **when** I comment, **then** internal staff see it, and my organization's other contacts see it.

### US-048 — Discuss a task privately 🟡

> **As** internal staff, **I want** task comments that clients can never see, **so that** we can discuss estimates and difficulties honestly without moving back to WhatsApp.

**Traces to:** FR-062, BR-14 · **Points:** 3

- **Given** a task comment exists, **when** a Client Contact views the project by any route, **then** the comment is not visible and not retrievable.

### US-049 — Pull someone into a conversation 🟡

> **As** any commenting user, **I want** to mention a colleague with `@`, **so that** they are alerted rather than relying on them noticing.

**Traces to:** FR-063, BR-19 · **Points:** 5

- **Given** I write `@amine` in a comment, **when** I post it, **then** Amine receives an in-app notification linking directly to that comment.
- **Given** I am a Client Contact, **when** I mention someone, **then** I can only mention users already visible to me in that deliverable's context.

### US-050 — See who said what 🔴

> **As** a Client Contact, **I want** to see the author's name on comments and activities shown to me, **so that** I know who I am dealing with.

**Traces to:** FR-061, BR-28 · **Points:** 1

- **Given** a comment written by a Team Member is client-visible, **when** I read it, **then** I see their name — but I cannot access the team roster, skills, workload, or assignments.

---

## EP-9 · Awareness

### US-051 — Be told when something concerns me 🟡

> **As** any user, **I want** in-app notifications for events affecting me, **so that** I do not have to hunt for changes.

**Traces to:** FR-064, BR-17 · **Points:** 5

- **Given** a task is assigned to me, **when** I open the application, **then** I have a notification about it.
- **Given** a deliverable of my organization is submitted, **when** I am a Client Contact, **then** I am notified.
- **Given** an event occurs, **when** notifications are generated, **then** no email and no push message is sent.

### US-052 — Manage my notifications 🟡

> **As** any user, **I want** to see my notifications newest-first with an unread count and mark them read, **so that** the list stays useful.

**Traces to:** FR-065 · **Points:** 3

- **Given** I have unread notifications, **when** I look at the header, **then** I see the unread count.
- **Given** I click a notification, **when** it opens, **then** I land on the exact task or deliverable it refers to and it is marked read.

### US-053 — Trace a project's history 🟡

> **As** internal staff, **I want** a chronological feed of everything that happened on a project, **so that** I can reconstruct decisions without searching WhatsApp.

**Traces to:** FR-066, FR-067 · **Points:** 5

- **Given** business events occur, **when** I open the project feed, **then** they appear newest-first with actor, action, and time.
- **Given** an activity is recorded, **when** anyone attempts to edit or delete it, **then** it is refused — activities are immutable.

### US-054 — See my project's history as a client 🟡

> **As** a Client Contact, **I want** a feed of the events that concern me, **so that** I can follow progress without asking my Project Manager.

**Traces to:** FR-067, BR-21, BR-28 · **Points:** 3

- **Given** a task is created, assigned, or commented on internally, **when** I view the feed, **then** those events do not appear.
- **Given** a deliverable is submitted or a milestone is completed, **when** I view the feed, **then** those events do appear.

---

## EP-10 · Dashboards and Client Portal

### US-055 — Run the agency at a glance 🔴

> **As** an Administrator, **I want** a dashboard showing project counts by status, active projects, team workload, agency-wide overdue tasks, and deliverables awaiting client approval, **so that** I have the overall view I currently lack.

**Traces to:** FR-068 · **Points:** 5

- **Given** I open my dashboard, **when** it loads, **then** every figure reflects current data.
- **Given** tasks are overdue in any project, **when** I open my dashboard, **then** they are listed with their project.

### US-056 — Know what needs me today 🔴

> **As** a Project Manager, **I want** my dashboard to lead with tasks awaiting my review, deliverables awaiting client response, and blocked tasks with their reasons, **so that** I spend my time unblocking rather than chasing.

**Traces to:** FR-069, BR-25 · **Points:** 5

- **Given** tasks in my projects are `In Review`, **when** I open my dashboard, **then** they are the primary call to action.
- **Given** another PM's project has tasks in review, **when** I open my dashboard, **then** they do not appear.

### US-057 — Know what I have to do 🔴

> **As** a Team Member, **I want** my dashboard to show my tasks grouped by status with what is due soon and overdue, **so that** I know what to work on without asking.

**Traces to:** FR-070, BR-26 · **Points:** 3

- **Given** I have tasks in several projects, **when** I open my dashboard, **then** all of them appear grouped by status.
- **Given** a task is assigned to someone else, **when** I open my dashboard, **then** it does not appear.

### US-058 — See deadline pressure without a scheduler 🔴

> **As** any internal user, **I want** due-soon and overdue tasks computed when I open the application, **so that** deadline awareness works without background jobs that can silently fail.

**Traces to:** FR-072, BR-20 · **Points:** 3

- **Given** a task is due within 3 days and not `Done`, **when** I open my dashboard, **then** it appears under *due soon*.
- **Given** a task's due date has passed and it is not `Done`, **when** I open my dashboard, **then** it appears under *overdue*.
- **Given** no user opens the application for a week, **when** someone finally logs in, **then** the alerts are correct — nothing was missed, because nothing was stored.

### US-059 — Follow my projects as a client 🔴

> **As** a Client Contact, **I want** a dashboard with my organization's projects, their progress, upcoming milestones, and deliverables awaiting my approval, **so that** I finally have visibility without emailing for updates.

**Traces to:** FR-071, BR-10, PG-04 · **Points:** 5

- **Given** my organization has projects, **when** I log in, **then** I see each with a progress percentage.
- **Given** a deliverable awaits my approval, **when** I log in, **then** it is the most prominent item on the page.
- **Given** another organization has projects, **when** I look anywhere in the interface, **then** none of them are visible or reachable.

### US-060 — Use the portal from my phone 🔴

> **As** a Client Contact, **I want** the portal to work properly on my phone, **so that** I can approve work without being at a desk.

**Traces to:** FR-073, NFR-08 · **Points:** 5

- **Given** a 375 px-wide viewport, **when** I use the portal, **then** I can view progress, open a deliverable, read comments, approve, request changes, and upload a file.
- **Given** any portal page, **when** I view it on a phone, **then** no horizontal scrolling is required to complete an action.

---

## EP-11 · Productivity Tools

### US-061 — Find anything quickly 🟡

> **As** any user, **I want** to search across projects, tasks, and deliverables, **so that** I can reach a record without navigating to it.

**Traces to:** FR-074 · **Points:** 5

- **Given** I search a term, **when** results return, **then** they include only records I am permitted to open.
- **Given** I am a Client Contact, **when** I search, **then** results are confined to my own organization.

### US-062 — Reuse our standard process 🟢

> **As** an Administrator or Project Manager, **I want** project templates defining our standard milestones, **so that** every project starts from the agency's proven process instead of a blank page.

**Traces to:** FR-075, A-06 · **Points:** 3

- **Given** I create a template with named, ordered milestones, **when** I save it, **then** it is available when creating a project.

### US-063 — Start a project from a template 🟢

> **As** a Project Manager, **I want** to create a project from a template, **so that** setup takes seconds rather than repeated manual entry.

**Traces to:** FR-076 · **Points:** 3

- **Given** I choose a template, **when** the project is created, **then** its milestones are copied in the template's order.
- **Given** I later edit the template, **when** I open the earlier project, **then** it is unchanged.

### US-064 — Export a project summary 🟢

> **As** a Project Manager, **I want** to export a project summary as PDF, **so that** I can share status in a meeting or archive it.

**Traces to:** FR-077 · **Points:** 5

- **Given** I export a project, **when** the PDF opens, **then** it contains project details, milestones with progress, and deliverable statuses.

### US-065 — See who is overloaded 🟢

> **As** an Administrator or Project Manager, **I want** to see how many active tasks each Team Member has, **so that** I can distribute work fairly.

**Traces to:** FR-078, BR-28 · **Points:** 3

- **Given** I open workload, **when** it loads, **then** each Team Member shows their count of non-done, non-cancelled tasks.
- **Given** I am a Client Contact, **when** I attempt to view workload, **then** access is refused.

---

## 2. Delivery Order

Stories are implemented as **vertical slices** (`00-Project-Foundation.md` §3.4) in strict MoSCoW order.

| Slice | Stories | Points | Outcome |
|---|---|---|---|
| **1 — Access** | US-001 – US-009, US-011, US-012 | 26 | Anyone can log in; roles are enforced; accounts and clients exist |
| **2 — Projects** | US-014 – US-020 | 22 | Projects exist, are owned, staffed, and correctly scoped per role |
| **3 — Work** | US-022 – US-024, US-026 – US-028, US-030 – US-034 | 30 | The full planning and execution loop with computed progress |
| **4 — Delivery** | US-035 – US-041, US-043, US-044, US-047, US-050 | 33 | The client approval loop end to end — the product's differentiator |
| **5 — Visibility** | US-055 – US-060 | 26 | Every role's dashboard and the mobile client portal |
| — | **Must-have total (46 stories)** | **137** | |
| **6 — Should** | US-010, US-013, US-021, US-025, US-029, US-042, US-045, US-046, US-048, US-049, US-051 – US-054, US-061 | 53 | Built only after all Must stories are complete and tested |
| **7 — Could** | US-062 – US-065 | 14 | Built only if time remains |

**Slice 4 is the demonstration centrepiece.** It is the sequence that proves AgencyFlow is more than a task list: a Project Manager submits work, a client reviews it on a phone, requests changes, receives a new version, and approves — with the entire exchange preserved.

---

## END OF DOCUMENT
