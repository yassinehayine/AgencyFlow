# ADR-0003 — File Storage Strategy

| | |
|---|---|
| **Status** | **Accepted** — 2026-07-30 |
| **Deciders** | Project Owner, Architect |
| **Resolves** | OQ-11 |
| **Affects** | FR-046, FR-055 – FR-059, BR-15, BR-16, BR-27, NFR-24, NFR-31, UC-26, UC-27 |
| **Supersedes** | — |

---

## Context

AgencyFlow stores uploaded files in three contexts (BR-16): Deliverable Files, Task Attachments, and Project Files. Files are limited to 20 MB and to business document and image formats (BR-15). No storage mechanism was chosen during Phases 1 or 2, and the question was raised as **OQ-11** during Phase 2 because it carries delivery risk disproportionate to its apparent size.

Six constraints govern the decision:

| # | Constraint | Source |
|---|---|---|
| S-1 | Files must survive application restarts and redeploys | BR-06, BR-07 — deliverable version history is the audit record of the agency–client negotiation |
| S-2 | Every download must be authorized server-side | FR-056, UC-27 E3 |
| S-3 | 20 MB maximum; documents and images only, no video | BR-15 |
| S-4 | Free or near-free at internship scale | OQ-06 |
| S-5 | Integrable within a 6-day implementation window | C-03, C-04 |
| S-6 | Replaceable without structural change | NFR-31, C-06 |

**S-1 is the risk that prompted this ADR.** The default approach in most tutorials — writing to the application server's local disk — fails silently on the free tiers of Render, Railway, Fly.io, and Heroku, all of which provide **ephemeral filesystems**. Uploads survive until the next restart or deploy, then vanish without an error. A deliverable model whose entire value is preserved version history cannot be built on storage that quietly empties itself.

**S-2 is the constraint most commonly violated.** Most storage integrations end by returning the provider's public URL to the browser. That URL then works for anyone who possesses it, indefinitely, with no authorization check — directly defeating BR-10 (client data isolation) and BR-28. Obscurity is not authorization.

## Options Considered

| Option | Survives redeploy | Free tier | Card required | Setup effort |
|---|---|---|---|---|
| Local disk on the app server | ❌ No on free PaaS | Free | No | Minutes |
| Local disk + persistent volume | ✅ Yes | Usually paid | Usually | Low |
| MongoDB GridFS | ✅ Yes | Atlas M0 = 512 MB **shared with application data** | No | Low |
| **Cloudinary** | ✅ Yes | ~25 GB equivalent | **No** | Low |
| Supabase Storage | ✅ Yes | 1 GB; free projects pause when idle | No | Low |
| Cloudflare R2 | ✅ Yes | 10 GB, zero egress | **Yes** | Medium |
| AWS S3 | ✅ Yes | 5 GB, 12 months only | **Yes** | High — IAM, policies, regions |

> Free-tier terms change without notice. Limits must be verified at signup rather than trusted from this document.

## Decision

**Three linked decisions.**

### 1. Cloudinary is the v1 storage provider

It is the only candidate that is free at this scale, requires **no credit card**, and needs no infrastructure configuration. Its Node SDK integrates in minutes, and `resource_type: 'raw'` handles the Office documents and ZIP archives BR-15 requires — a detail easily missed, since Cloudinary is usually presented as an image service.

For a project with six implementation days and no budget, "working in an hour, no card, no IAM policy" outweighs S3's superior production credentials.

### 2. Downloads are proxied through permission-checked API endpoints

The browser requests `GET /api/v1/files/:id`. NestJS resolves the file's context, applies the BR-10 and BR-28 checks, then streams the bytes. **The Cloudinary URL is never exposed to the client.**

The alternative — verifying permission and returning a short-lived signed URL — is more efficient and is the correct pattern at scale. It is rejected for v1 because it introduces provider-specific signing logic and a second failure mode, and because at ≤30 concurrent users with ≤20 MB files (NFR-15, BR-15) the cost of proxying is not measurable.

### 3. All access goes through a `StorageService` port

A single interface — `upload`, `getStream`, `delete` — with one Cloudinary adapter behind it. Approximately 40 lines.

This is what makes NFR-31 real rather than aspirational. Replacing Cloudinary with R2 or S3 becomes one new adapter class touching zero business logic, and Phase 9 can test file features against an in-memory fake instead of the network.

## Consequences

### Positive

- Files survive redeploys — S-1 satisfied, and the risk that prompted OQ-11 is eliminated
- Authorization is enforced on every byte served — S-2 satisfied by construction, not by convention
- No credit card, no cloud account setup, no IAM policy — hours saved from a 6-day budget
- The provider is replaceable behind one interface — S-6 satisfied
- File features become unit-testable without network access

### Negative

- All file bytes traverse the application server, consuming its bandwidth and a request thread. Acceptable at the stated scale; the first thing to change if it is not
- A third-party runtime dependency is introduced. It was previously a deliberate goal to have none (SRS §11, Dependencies). If Cloudinary is unavailable, uploads and downloads fail — though existing application data is unaffected
- One additional secret to manage (`CLOUDINARY_URL`), governed by NFR-25 and the `.env.example` convention
- Vendor-specific concepts (`resource_type`, `public_id`) leak into the adapter. Contained there by design

### Neutral

- Storage consumption is not monitored in v1. At internship scale the free tier will not be approached

## Migration Trigger

Move to **Cloudflare R2** or S3-compatible object storage with signed URLs when **any** holds:

- Stored data exceeds ~20 GB
- Proxy bandwidth becomes a measured bottleneck
- The application is commercialized and needs a contractual SLA
- Egress cost appears on an invoice

The `StorageService` port makes this a single-adapter change.

## Compliance Actions

| Action | Owner | When |
|---|---|---|
| **Upload one file end-to-end to the real deployed environment** | Developer | **Week 1** — per RISK-04. Storage is the component most likely to fail late, and a redeploy that empties the store during a demo is unrecoverable |
| Add `CLOUDINARY_URL` to `.env.example` with no real value | Developer | Slice 1 |
| Validate MIME type server-side; never trust the client-declared type | Developer | Slice 4 (NFR-24) |
| Confirm free-tier limits and `resource_type: 'raw'` support at signup | Developer | Week 1 |
