# ADR-0006 — Backend Hosting Platform: Railway

| | |
|---|---|
| **Status** | **Accepted** — 2026-08-03 |
| **Deciders** | Project Owner, Architect |
| **Resolves** | Re-opens and re-answers the backend half of OQ-06 |
| **Affects** | `05-Software-Architecture.md` §15, §17 · `06-Database-Design.md` §11 · AR-09, AR-10 · NFR-27 · `DEPLOYMENT.md` |
| **Supersedes** | The **Render** row of the deployment decision in `05-Software-Architecture.md` §15 |

---

## Context

`05-Software-Architecture.md` §15 fixed the backend target as **Render Web Service, free tier**, chosen when OQ-06 was resolved. All deployment configuration was written against it: `render.yaml` as a Blueprint, `sync: false` secrets, `generateValue` for the signing key, and a health check at `/health`.

At the point of first deployment, Render's free tier was found to **no longer host a web service without a paid plan**. The blueprint applies and then requires a card before the service will run.

This is a platform-terms change, not a design error. Nothing about the application was wrong; the assumption underneath the platform row expired. It is recorded here rather than fixed silently because `00-Project-Foundation.md` §13.6 is explicit: *"Do not silently deviate. Silent deviation is how documentation becomes fiction."* — and a design document naming a platform the project does not use is exactly that.

## Decision

**The NestJS API is deployed to Railway.** The frontend remains on Vercel, the database on MongoDB Atlas M0, and file storage on Cloudinary. No application code changes.

## Options Considered

| Option | Runs a always-on web service without a card | Sleeps when idle | Config as code | Effort to switch |
|---|---|---|---|---|
| Render (paid Starter) | Yes, $7/month | No | `render.yaml` | None — but out of budget (S-4) |
| **Railway** | **$5 trial credit, 30 days; then $1/month free credits** | **No** | `railway.toml` | Low — same build, same start command |
| Fly.io | Free allowance, card required at signup | No | `fly.toml` | Medium — Dockerfile, machine sizing |
| Koyeb | One free service | No | Dashboard / `koyeb.yaml` | Medium |
| Vercel Functions | Yes | Cold starts | `vercel.json` | **High — NestJS is not serverless-shaped** |

Vercel Functions deserves the explicit rejection, because "the frontend is already there" makes it look like the obvious consolidation. A NestJS application is a long-lived process with a Mongoose connection pool, in-process domain events (`05-Architecture` §9), and a boot-time environment validation step. Running it per-request means re-establishing the connection pool on cold starts and losing the event listeners that ADR-0004 relies on. The framework would have to be re-architected to fit the platform — the opposite of the direction a decision at this stage should go.

**Railway is chosen** because the switch costs a configuration file and nothing else: the build command, the start command, the health check path, and the environment contract are all identical. The API was written to read `PORT` from the environment and bind `0.0.0.0` precisely so the host could be swapped (`05-Architecture` §15), and this is that assumption being cashed in.

## Consequences

### What improves

**AR-09 is substantially reduced.** Railway does not sleep a service after idle; the 30–60 second wake-up that made a demonstration look like a broken product is gone. The cold-start handling in `QueryBoundary` stays — it is still correct for the first request after a deploy, and for a service stopped for exceeding credits — but it is no longer the difference between a working demo and an apparent failure. The §15.1 mitigation *"open the application 5–10 minutes before any demonstration"* is no longer necessary, only prudent.

### What does not change

**AR-10 stands unchanged.** Railway does not provide a static outbound IP on the free or trial plans either, so the Atlas allowlist must still permit `0.0.0.0/0`. The database remains reachable from any address holding valid credentials, mitigated exactly as before: a strong generated password, a least-privilege database user, and the connection string held only as an environment variable (NFR-25).

**ADR-0003 stands unchanged, and for the reason it always gave.** Railway's filesystem is ephemeral in the same way Render's is — ADR-0003 §Context already named Railway among the platforms whose free tiers silently empty local disk. The storage decision was made against the *class* of platform rather than against one vendor, which is why a change of vendor does not disturb it.

**NFR-27 stands.** A single instance, no load balancer.

### What gets worse

**The free allowance is tighter, and it is metered rather than throttled.** Render's free tier traded availability for cost — a sleeping service, but an indefinitely free one. Railway trades the other way: the service stays awake, but usage is billed against credits. The $5 trial covers roughly a month of a small always-on service, and the ongoing free plan's **$1/month will not** keep one running continuously.

For an internship delivered in weeks that is the right trade — a responsive demonstration matters more than indefinite uptime, and the project has a defined end date. But it is a real expiry rather than a degradation, and it fails **closed and silently**: the service stops rather than slowing down. Recorded as **AR-11**.

> **Mitigation.** Check the Railway usage page before any scheduled demonstration. If credits are short, the $5 Hobby plan restores a month of headroom for less than the cost of the alternative, and the deployment does not need to move again.

### Migration surface

| Artefact | Change |
|---|---|
| `render.yaml` | Deleted |
| `railway.toml` | Added — same build chain, same start command, same `/health` check |
| `JWT_SECRET` | Railway has no `generateValue`; generated once by hand and pasted, documented in `DEPLOYMENT.md` §4 |
| Public URL | Railway does **not** expose a service publicly by default. A domain must be generated explicitly — the single most likely step to be missed |
| Application code | **None** |

The absence of application changes is the point worth keeping. A hosting decision that required editing services would have meant the architecture had leaked into the platform; that it required one config file is the evidence that it had not.
