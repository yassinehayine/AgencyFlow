# AgencyFlow

Centralized project delivery and client approval platform for a single digital and communication agency.

Agency staff plan projects, assign work and deliver output; client contacts follow progress in their own portal and formally approve deliverables through a versioned review process.

> **Internship engineering project.** The complete design baseline — requirements, architecture, database, UML and blueprints — is in [`docs/`](./docs) and is frozen. Every line of code traces to a requirement id.

---

## Status

**Slice 1 — Foundation & Access.** Application skeleton, quality gates, database, authorisation infrastructure. Business features begin in Slice 2.

---

## Stack

| Layer | Technology |
|---|---|
| Backend | NestJS 11 · Node.js 24 LTS |
| Database | MongoDB 7 (replica set) · Mongoose |
| Frontend | React 19 · Vite 6 · TypeScript · Tailwind CSS |
| Server state | TanStack Query |
| Validation | class-validator (API) · Zod (web) |
| Auth | JWT, 12-hour expiry |
| File storage | Cloudinary |

## Repository layout

```
agencyflow/
├── apps/
│   ├── api/          NestJS backend
│   └── web/          React client
├── packages/
│   ├── contracts/    Shared types and enums (zero runtime dependencies)
│   └── config/       Shared TypeScript configuration
└── docs/             Approved design baseline (phases 1–7)
```

## Prerequisites

- **Node.js 24 LTS** (see `.nvmrc`)
- **Docker Desktop** — runs the local MongoDB replica set
- npm 10+

## Getting started

```bash
git clone https://github.com/yassinehayine/AgencyFlow.git
cd AgencyFlow
npm install

cp .env.example .env          # then fill in the values
npm run db:up                 # MongoDB replica set (~15s to become healthy)

npm run build --workspace @agencyflow/contracts
npm run dev:api               # http://localhost:3000
npm run dev:web               # http://localhost:5173
```

Confirm the stack is wired: <http://localhost:5173> shows the system status page, and `curl http://localhost:3000/health` returns `database: "up"`.

### Generating a JWT secret

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

> **`storage: "down"` is expected** until real Cloudinary credentials are placed in `.env`. Everything else works without them.

## Why MongoDB runs as a replica set locally

Not optional. Multi-document transactions require a replica set, and the cascading project delete spans six collections. MongoDB Atlas is a replica set in production, so a standalone container locally would let transactions pass in one environment and fail in the other. `docker-compose.yml` initiates the set through its healthcheck — `npm run db:up` is all that is needed.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev:api` / `npm run dev:web` | Development servers |
| `npm run build` | Build all workspaces in dependency order |
| `npm run typecheck` | Type-check every workspace |
| `npm test` | Run tests |
| `npm run lint` / `npm run format` | Lint / format |
| `npm run db:up` / `npm run db:down` | Start / stop MongoDB |

## Quality gates

Every push and pull request runs: format → lint (zero warnings) → type-check → tests → build → dependency audit. With a solo developer there is no second reviewer, so these checks *are* the review. A red pipeline is never merged and never disabled.

Locally, husky enforces the same standards: `lint-staged` on pre-commit, `commitlint` on commit-msg. Commits follow [Conventional Commits](https://www.conventionalcommits.org/).

## Documentation

| Document | Contents |
|---|---|
| [`00-Project-Foundation`](docs/00-Project-Foundation.md) | Methodology, conventions, roadmap |
| [`01-SRS`](docs/01-Software-Requirements-Specification.md) | 81 requirements, 33 business rules |
| [`02-User-Stories`](docs/02-User-Stories.md) · [`03-Use-Cases`](docs/03-Use-Cases.md) | 65 stories, 32 use cases |
| [`04-RTM`](docs/04-Requirements-Traceability-Matrix.md) | Full traceability, both directions |
| [`05-Architecture`](docs/05-Software-Architecture.md) | Modular monolith, C4 views, security |
| [`06-Database-Design`](docs/06-Database-Design.md) | MCD / MLD / MPD, 10 collections, indexes |
| [`07-UML-Design`](docs/07-UML-Design.md) | 31 diagrams |
| [`08-Backend`](docs/08-Backend-Design.md) · [`09-Frontend`](docs/09-Frontend-Design.md) | Implementation blueprints |
| [`adr/`](docs/adr) | Architecture Decision Records |

## Licence

Unlicensed — private internship project.
