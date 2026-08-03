# AgencyFlow API — container image (ADR-0006)
#
# Built from the REPOSITORY ROOT, not from this directory:
#
#     docker build -f apps/api/Dockerfile -t agencyflow-api .
#
# npm workspaces resolve `@agencyflow/contracts` and `@agencyflow/config`
# through symlinks in the root `node_modules`, so a build context rooted at
# `apps/api` cannot see them. `railway.toml` sets `dockerfilePath`
# accordingly.
#
# --- Why a Dockerfile rather than the automatic builder --------------------
#
# Railpack inspects the repository and configures itself. It found the Vite
# frontend and mounted a build cache at `apps/web/node_modules/.vite` — for a
# service that never builds the frontend. `npm ci` begins by removing
# `node_modules`, a mount point cannot be removed, and the build died on
# `EBUSY: resource busy or locked, rmdir '/app/apps/web/node_modules/.vite'`.
#
# The error was confusing because it named the frontend in a backend build.
# A Dockerfile states what this image contains instead of leaving it to be
# inferred, which is the actual fix: the frontend is not merely skipped, it is
# never copied into the build context at all.

# ---------------------------------------------------------------------------
# Stage 1 — build
# ---------------------------------------------------------------------------
# `-slim` (Debian) rather than `-alpine`: bcrypt is a native module and ships
# prebuilt binaries for glibc. On musl it would fall back to compiling from
# source, which needs python3 and a toolchain in the image for no benefit.
FROM node:24-slim AS build

WORKDIR /app

# Manifests first, source second. Docker caches layers by content, so this
# ordering means editing a service file does not re-run the install — which is
# most of the build time, and on a metered plan most of the cost (AR-11).
#
# Every workspace named in the root `workspaces` glob must have its manifest
# present, or npm refuses to plan the tree.
COPY package.json package-lock.json ./
COPY packages/config/package.json packages/config/
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

# `--include=dev` because the build needs @nestjs/cli and typescript, both
# devDependencies. `NODE_ENV` is deliberately NOT set in this stage: setting
# it to production makes npm skip devDependencies regardless of this flag.
#
# `--workspace @agencyflow/api --include-workspace-root` installs the API, the
# root's shared tooling, and the two packages the API depends on — and nothing
# for the web client. That is what keeps `apps/web/node_modules` from existing.
# `npm pkg delete scripts.prepare` first. The root `prepare` script runs
# `husky`, which installs Git hooks — meaningless in an image that has no
# `.git`, and fatal in the runtime stage below where husky is a devDependency
# that `--omit=dev` correctly leaves out. It fails as `husky: not found`,
# exit 127, from a line that says nothing about hooks.
#
# Deleted rather than suppressed with `HUSKY=0`: that variable makes husky
# skip its work, but the `prepare` script still tries to EXECUTE a binary that
# is not installed, so it would fix the build stage and not the runtime one.
RUN npm pkg delete scripts.prepare \
 && npm ci --include=dev --workspace @agencyflow/api --include-workspace-root

# `packages/config` supplies `tsconfig.base.json`, which all three tsconfigs
# extend. It is copied because it is a real build input, not a convenience.
COPY packages/config packages/config
COPY packages/contracts packages/contracts
COPY apps/api apps/api

# Contracts first: it is a workspace dependency resolved through a symlink, so
# its `dist` must exist before `nest build` type-checks against it.
RUN npm run build --workspace @agencyflow/contracts \
 && npm run build --workspace @agencyflow/api

# ---------------------------------------------------------------------------
# Stage 2 — runtime
# ---------------------------------------------------------------------------
# A second stage so the shipped image carries no compiler, no test runner and
# no source. Smaller to pull on every deploy, and a smaller surface to reason
# about.
FROM node:24-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY packages/config/package.json packages/config/
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

# Production dependencies only. The workspace symlinks are still created,
# which is what lets `require('@agencyflow/contracts')` resolve at runtime.
RUN npm pkg delete scripts.prepare \
 && npm ci --omit=dev --workspace @agencyflow/api --include-workspace-root \
 && npm cache clean --force

COPY --from=build /app/packages/contracts/dist packages/contracts/dist
COPY --from=build /app/apps/api/dist apps/api/dist

# Drop root. The image ships with a `node` user for exactly this.
USER node

# PORT is injected by the platform and read by the application; it is not
# hard-coded here, and `main.ts` binds 0.0.0.0 so the container is reachable
# from outside itself.
EXPOSE 3000

CMD ["node", "apps/api/dist/main.js"]
