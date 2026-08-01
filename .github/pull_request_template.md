## What and why

<!-- The diff shows what changed. Explain WHY it changed. -->

Closes #

## Traceability

<!-- Every change traces to the frozen baseline (EG-07). -->

- Requirement(s): <!-- FR-0xx -->
- Business rule(s): <!-- BR-xx, or "none" -->

## Definition of Done

<!-- 00-Project-Foundation.md section 14.1. Every box, no partial credit. -->

- [ ] Acceptance criteria in the issue are met
- [ ] Authorisation enforced **server-side**, not by hiding UI (NFR-20)
- [ ] Client data isolation respected where applicable (BR-10)
- [ ] Input validated at the API boundary (NFR-22)
- [ ] Error paths handled, not only the happy path
- [ ] Unit tests written for new business logic
- [ ] No `console.log`, commented-out code, or unreferenced `TODO`
- [ ] No secret, credential, or `.env` file committed
- [ ] Relevant documentation updated in the same PR
- [ ] UI strings in French, code in English (NFR-06)
- [ ] CI fully green
- [ ] Self-reviewed as a full diff on GitHub

## Deviations from the approved design

<!-- Silent deviation is how documentation becomes fiction
     (00-Project-Foundation.md section 13.6). State any here, or "none". -->

none
