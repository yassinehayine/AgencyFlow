# AgencyFlow — Deployment Runbook

**Not a phase deliverable.** The numbered `00`–`09` documents are the frozen design baseline. This is an operational document and is expected to change whenever the deployment does.

| Component | Platform | Plan | Source of truth |
|---|---|---|---|
| API (NestJS) | **Railway** | Trial / Free | `railway.toml` + `apps/api/Dockerfile` |
| Web (React/Vite) | Vercel | Hobby | `vercel.json` |
| Database | MongoDB Atlas | M0 | Atlas dashboard |
| File storage | Cloudinary | Free | Cloudinary dashboard |

Targets fixed in `05-Software-Architecture.md` §15 and confirmed by the Project Owner when resolving OQ-06. The backend moved from Render to Railway on 2026-08-03 — see [ADR-0006](adr/0006-backend-hosting-platform.md) for why, and for what did **not** change.

---

## 1. Why this is being done now

`05-Software-Architecture.md` records **RISK-04**: deployment is discovered to be broken late, when there is no time left to fix it. Storage and deployment are the two components most likely to fail for environmental reasons rather than logical ones, and neither can be proven by a local test.

So the pipeline is validated while the application is still a health endpoint and a status page. A cold start, a missing environment variable, or a CORS refusal costs an afternoon now; the same failure discovered in the final week costs the deadline.

---

## 2. Order of operations

The four steps have real dependencies, and doing them out of order produces confusing failures.

```mermaid
flowchart LR
    A[1 · Atlas cluster] --> B[2 · Railway API]
    B -->|API URL| C[3 · Vercel web]
    C -->|Vercel URL| D[4 · Set CORS_ORIGIN<br/>on Railway]
    A --> S[5 · Seed the Administrator]
    D --> E[6 · Verify]
    S --> E
```

Steps 2 and 3 each need the other's URL, which is why `CORS_ORIGIN` is set *after* Vercel exists, as a separate step. There is no ordering that avoids this; the loop is closed by deploying with a placeholder and correcting it.

Step 5 depends only on Atlas, so it can be done any time after step 1 — but it is not optional, and skipping it produces a fully working deployment that **nobody can log into**. See §7.

---

## 3. Step 1 — MongoDB Atlas M0

1. Create a free **M0** cluster. Region: closest available to `eu-central`, so it sits near the Railway `europe-west4` region (§4.3).
2. **Database Access** → create a user with `readWrite` on the `agencyflow` database. Use a generated password with no URL-reserved characters, or percent-encode it.
3. **Network Access** → add `0.0.0.0/0`.

> ⚠️ **AR-10.** Neither Render's nor Railway's free plan offers static outbound IP addresses, so the Atlas allowlist cannot be narrowed to specific hosts. `0.0.0.0/0` permits any IP to *attempt* a connection; authentication still requires the database credentials. This is an accepted, documented risk of the free tier, mitigated by a strong generated password and by the database containing no production data during development.

4. Copy the connection string. It must include the database name:

```
mongodb+srv://<user>:<password>@<cluster>.mongodb.net/agencyflow?retryWrites=true&w=majority
```

Atlas clusters are replica sets, so transactions work — that is the requirement from `06-Database-Design.md` §9.3, and the reason local development uses a single-node replica set rather than a standalone `mongod`.

---

## 4. Step 2 — Railway API

**railway.com → New Project → Deploy from GitHub repo → select the repository.** Railway reads `railway.toml`, which points it at `apps/api/Dockerfile`. Nothing is configured by hand except the variables.

> **Why a Dockerfile and not Railway's automatic builder.** Railpack inspects the repository and configures itself from what it finds. It found the Vite frontend and mounted a build cache at `apps/web/node_modules/.vite` — for a service that never builds the frontend. `npm ci` begins by removing `node_modules`, a mount point cannot be removed, and the build died on `EBUSY: resource busy or locked, rmdir '/app/apps/web/node_modules/.vite'`. A backend build failing on a frontend path is a builder acting on a guess. The Dockerfile states what the image contains rather than leaving it to be inferred — see §11.

### 4.1 Variables

Railway has no equivalent of Render's `sync: false` or `generateValue`, so **all five** are set by hand in the service's **Variables** tab. `PORT` is injected by Railway and must not be set.

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `MONGODB_URI` | The Atlas string from step 1 |
| `CLOUDINARY_URL` | `cloudinary://<api_key>:<api_secret>@<cloud_name>` |
| `CLOUDINARY_FOLDER` | `agencyflow` |
| `JWT_SECRET` | Generated locally — see below |
| `CORS_ORIGIN` | `https://placeholder.vercel.app` — corrected in step 4 |

Render generated the signing key itself. Railway does not, so generate one and paste it:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

It must differ from the development secret and must never be committed: a leaked development token would otherwise authenticate against production (BR-10, NFR-19). 48 random bytes comfortably clears the 32-character minimum that boot validation enforces.

### 4.2 Generate the public domain

**Settings → Networking → Generate Domain.**

This is the step most likely to be missed, because nothing looks wrong without it. Railway does **not** expose a service publicly by default — the deployment goes green, the logs show the API listening, and the service is reachable only from inside the project's private network. There is no error to read; there is simply no URL.

Railway will ask which port to expose. The app reads `PORT` from the environment, so accept the port Railway detects.

### 4.3 Region

**Settings → Deploy → Region → `europe-west4` (Amsterdam)** — the closest Railway offers to the Atlas cluster in Frankfurt. Not required, but every database round trip pays the difference, and the dashboards make several per request.

### 4.4 Expected result

The first build takes several minutes. Watch the deploy log for, in order:

```
npm ci --include=dev            # devDependencies present, or `nest` is missing later
@agencyflow/contracts build     # must precede the API build
nest build
AgencyFlow API listening on ...
Cloudinary configured (cloud: ..., folder: agencyflow)
```

Then, from anywhere:

```bash
curl https://<your-service>.up.railway.app/health
# {"status":"ok","dependencies":{"database":"up","storage":"up"}}
```

`database: "up"` proves Atlas connectivity and the allowlist. `storage: "up"` proves the Cloudinary credentials. A single request validates both external dependencies — which is exactly what the health endpoint was designed for.

---

## 5. Step 3 — Vercel web client

**New Project → import the repository. Leave Root Directory at the repository root.**

This is the one setting that is easy to get wrong. Pointing Root Directory at `apps/web` makes Vercel run `npm ci` inside that directory, where the npm workspace link to `@agencyflow/contracts` does not resolve — the build fails on a missing module that plainly exists. `vercel.json` at the root handles the workspace ordering instead:

| Setting | Value | Why |
|---|---|---|
| `installCommand` | `npm ci` | Installs the whole workspace tree, including the symlink to `contracts` |
| `buildCommand` | contracts, then web | `contracts` must emit its ESM `dist` before Vite can resolve it |
| `outputDirectory` | `apps/web/dist` | Vite's output, relative to the repository root |
| `rewrites` | everything → `/index.html` | Client-side routing: a deep link must not 404 on refresh. Vercel serves real files first, so assets are unaffected |

**Environment variable** (Production, Preview, Development):

| Variable | Value |
|---|---|
| `VITE_API_URL` | `https://<your-service>.up.railway.app` — **no trailing slash** |

> Vite inlines `VITE_`-prefixed variables at **build** time. Changing this value requires a redeploy, not a restart, and nothing placed here can be secret — it ships to the browser in plain text.

---

## 6. Step 4 — Close the CORS loop

Return to Railway → **Variables** and set `CORS_ORIGIN` to the real Vercel production origin, e.g. `https://agencyflow.vercel.app`. Railway redeploys the service on a variable change.

**Known limitation.** `CORS_ORIGIN` accepts exactly one origin, so Vercel *preview* deployments (which get a new URL per commit) are refused by the API. That is the correct trade-off for now: a permissive origin regex is a real security weakness, and preview builds can be checked against a locally running API. If preview environments become part of the workflow, the fix is an explicit allow-list, not a wildcard.

---

## 7. Step 5 — Seed the first Administrator

**Without this step the deployment is complete and unusable.** FR-007 and BR-11 mean there is no registration endpoint: every account exists because an Administrator created it. A fresh Atlas database has no Administrator, so there is no first door — which is what `apps/api/scripts/seed-admin.js` exists to be. It is deliberately outside the HTTP surface: nothing reachable over the network can create an Administrator from nothing.

Railway does offer a shell (`railway run`), but the seed is still run **from a developer machine against Atlas**. That is not a workaround: the script needs credentials that the platform holds as secrets, and running it locally keeps the one privileged operation in the hands of a person rather than in a deploy hook.

```powershell
npm run build --workspace @agencyflow/contracts
npm run build --workspace @agencyflow/api

# The whole application boots, so every variable it validates must be present.
$env:MONGODB_URI       = "<the Atlas string from step 1>"
$env:JWT_SECRET        = "any-value-at-least-32-characters-long-unused-here"
$env:CLOUDINARY_URL    = "<the same value given to Railway>"
$env:CORS_ORIGIN       = "https://placeholder.local"

$env:SEED_ADMIN_NAME     = "Your Name"
$env:SEED_ADMIN_USERNAME = "your.name"
$env:SEED_ADMIN_EMAIL    = "you@agencyflow.ma"
$env:SEED_ADMIN_PASSWORD = "<a real password, 8+ characters>"

npm run seed:admin --workspace @agencyflow/api
```

Three things worth stating precisely, because each one has a silent failure mode:

- **`process.env` overrides the repository's `.env` file.** `@nestjs/config` does not let a file overwrite a variable that is already set, so exporting `MONGODB_URI` above genuinely redirects the seed at Atlas. Verified rather than assumed — the failure it prevents is seeding the *local* database and believing production is ready.
- **`JWT_SECRET` and `CORS_ORIGIN` are placeholders here.** The script signs nothing and serves nothing; they are present only because boot-time validation refuses to start without them. Do **not** copy the production `JWT_SECRET` onto a laptop to satisfy a check that does not use it.
- **The script is idempotent.** If an active Administrator already exists it changes nothing and exits 0, so re-running it after a failed attempt is safe.

Expected output:

```
Administrator created: you@agencyflow.ma (username: your.name)
Log in through the web client and create the rest of the team from there.
```

Every other account — Project Managers, Team Members, client organisations and their contacts — is then created through the interface, which is the rule this whole arrangement exists to preserve.

---

## 8. Step 6 — Verification checklist

Run these in order. Each one isolates a different failure.

| # | Check | Command / action | Proves |
|---|---|---|---|
| 1 | API is alive | `curl https://<api>/health` | Build, boot, and env validation succeeded |
| 2 | Database reachable | `dependencies.database == "up"` | Atlas credentials + `0.0.0.0/0` allowlist |
| 3 | Storage reachable | `dependencies.storage == "up"` | Cloudinary credentials survived the environment copy |
| 4 | Versioning intact | `curl https://<api>/api/v1/health` → **404** | The global prefix excludes `/health` as designed |
| 5 | Web client loads | Open the Vercel URL | Vite build and output directory are correct |
| 6 | **Cross-origin call succeeds** | The status page shows the API's health, not an error | `CORS_ORIGIN` matches the Vercel origin exactly |
| 7 | **Login works** | Sign in with the seeded Administrator | Step 5 ran, and JWT signing works with the production secret |
| 8 | Role routing | An Administrator lands on `/app/dashboard` | The two route trees resolve behind Vercel's SPA rewrite |
| 9 | Deep link survives refresh | Reload while on `/app/projects` | The `rewrites` rule is serving `index.html` rather than 404 |
| 10 | **Upload and download** | Attach a file to a deliverable, then download it | Cloudinary write path *and* the proxied read (ADR-0003 S-2) |
| 11 | **Client isolation** | Log in as a Client Contact of one organisation | BR-10 holds across the real network, not only in tests |
| 12 | **Cold start is handled** | Wait 15+ minutes, then reload the status page | AR-09: the client shows the waking message, not a failure |

Check 6 is the one that catches the classic mistake. A trailing slash, `http` instead of `https`, or the preview URL instead of the production URL all produce the same browser console message: *blocked by CORS policy*. The API log will show the origin it actually received; compare the two strings character by character.

Check 10 is worth doing by hand even though the slice-5 script covers it locally, because it is the only check that exercises a **third** external service across the real network. A Cloudinary credential that survived the copy into Railway still has to work from Amsterdam, and the download half proves the proxy rather than a provider URL — the guarantee ADR-0003 S-2 rests on.

Check 12 changed meaning with ADR-0006 and is kept for a different reason. Railway does **not** sleep an idle service, so the routine 15-minute suspension and its 30–60 second wake-up are gone — which is the single biggest practical gain from the move. What remains is the first request after a deploy, which still waits on the Mongoose connection to Atlas, and a service stopped for exhausted credits, which takes just as long to come back. `QueryBoundary` swaps the spinner for an explanatory French message after 5 seconds for both (AR-09). A user who sees a frozen screen concludes the application is broken; a user who is told the server is waking waits.

**What replaces it is AR-11.** Railway meters usage rather than throttling it: the Free plan's $1/month of credits will not keep an always-on service running, and the $5 trial covers roughly a month. The failure mode is worse than sleeping because it is *silent and closed* — the service stops rather than slowing. **Check the Railway usage page before any demonstration.**

---

## 9. What is deliberately not automated

| Not automated | Why |
|---|---|
| Creating the Railway and Vercel projects | Both require account authentication. A one-time click is cheaper and clearer than storing platform tokens in CI |
| Secrets in `railway.toml` | The file carries build and deploy settings only; every secret is entered in the dashboard and never enters Git (NFR-25) |
| `npm run verify:storage` in CI | Needs real credentials and makes live network calls against a shared free-tier account |

Deploys themselves **are** automated: Railway's GitHub integration and Vercel's both build on every push to `main`. `watchPatterns` in `railway.toml` keeps a frontend-only commit from rebuilding the backend. Combined with branch protection, that means only reviewed, CI-passing code ever reaches either platform.

---

## 10. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Build fails, `nest: not found` | `NODE_ENV=production` made npm skip devDependencies | `npm ci --include=dev` — already in `railway.toml` |
| Build fails, cannot resolve `@agencyflow/contracts` | Built out of order, or Vercel Root Directory set to `apps/web` | Build `contracts` first; keep Root Directory at the repository root |
| Boot fails, `Invalid environment configuration` | A variable is missing or malformed | The error names every failing variable at once — read the whole list before redeploying |
| `database: "down"` | Atlas allowlist, or a password with unescaped URL characters | Confirm `0.0.0.0/0`; percent-encode the password |
| `storage: "down"` | `CLOUDINARY_URL` truncated on copy | Re-copy from the Cloudinary dashboard; the value ends with the cloud name |
| Web shows a JSON parse error | `VITE_API_URL` unset in the Vercel build | The client requested Vercel's own domain and received `index.html` |
| Blocked by CORS policy | `CORS_ORIGIN` does not match byte for byte | Compare the origin in the Railway log with the browser's; watch for a trailing slash |
| First request after a deploy is slow | Boot plus the first Atlas connection | Expected (AR-09), and much rarer on Railway than it was on Render. The client waits; the timeout must not be shortened |
| Login returns 401 with correct credentials | The Administrator was never seeded, or was seeded into the *local* database | Re-run §7 with `MONGODB_URI` exported in the shell; the script is idempotent |
| Seed reports "already exists" but login still fails | It connected to local MongoDB, not Atlas | Confirm the exported `MONGODB_URI` starts `mongodb+srv://` and names the `agencyflow` database |
| Vercel build fails on the Node version | `engines.node` names a major Vercel does not offer | Vercel offers majors only (24.x, 22.x, 20.x); keep the range bounded and current |
| `EBUSY … rmdir '/app/apps/web/node_modules/.vite'` | An automatic builder mounted a Vite cache into a backend build; `npm ci` cannot delete a mount point | Build from `apps/api/Dockerfile` (§11), which never puts the frontend in the context |
| Container build fails, `husky: not found` | The root `prepare` script runs husky, a devDependency that `--omit=dev` correctly omits | `npm pkg delete scripts.prepare` before installing — already in the Dockerfile |
| Container build fails, `tsconfig.base.json not found` | `@agencyflow/config` was not installed by a pruned install | It is now a declared devDependency of every workspace that extends it |
| Railway deploy is green but the URL 404s or does not exist | No public domain was generated | Settings → Networking → **Generate Domain** (§4.2). Railway exposes nothing publicly by default |
| Railway health check fails, logs show the app listening | The service bound a port Railway is not routing to | The app reads `PORT` from the environment; confirm `PORT` was **not** set by hand as a variable |
| Service stops with no error and no crash in the logs | Railway credits exhausted (AR-11) | Check the usage page; the Free plan's $1/month will not sustain an always-on service |
| Deploy fails, `MongooseServerSelectionError` at boot | Atlas was still provisioning, or the allowlist had not propagated | Wait for the cluster to report *Active*, then redeploy — `serverSelectionTimeoutMS` is 5 s by design, to fail fast rather than hang |


---

## 11. The API container

The deployed artefact is an image built from `apps/api/Dockerfile`, from the **repository root** as the build context:

```bash
docker build -f apps/api/Dockerfile -t agencyflow-api .
```

Two stages. The first installs with `--include=dev` and builds; the second installs with `--omit=dev` and copies only the two `dist` directories across, so the shipped image carries no compiler, no test runner and no source.

### 11.1 The pruned install

```
npm ci --include=dev --workspace @agencyflow/api --include-workspace-root
```

This is the line that matters, and it is why the frontend cannot interfere. It installs the API, the root's shared tooling, and the two packages the API depends on — and nothing for the web client, so `apps/web/node_modules` is never created and the `.vite` cache directory that broke the automatic builder has nowhere to exist.

It also exposed a latent defect worth recording. `packages/config` supplies the `tsconfig.base.json` that **all three** other workspaces extend by bare specifier, and **nothing declared it as a dependency**. It resolved only because a full workspace install symlinks every workspace into `node_modules/@agencyflow/` whether anyone asked for it or not. The first pruned install failed on a missing tsconfig — a build held together by an accident of installation. It is now declared where it is used.

### 11.2 Two things that only fail in a container

| | |
|---|---|
| `prepare` runs `husky` | npm runs `prepare` after every install. Husky is a devDependency, so `--omit=dev` leaves it out and the install dies with `husky: not found`, exit 127 — from a line that says nothing about Git hooks. The Dockerfile deletes the script rather than setting `HUSKY=0`: that variable makes husky skip its work, but `prepare` would still try to execute a binary that is not installed |
| Host `node_modules` leaking in | `COPY apps/api apps/api` would carry the host's `node_modules` and `dist` into the image on top of the ones just built — a Windows-built native module in a Debian container, and a stale `dist` shadowing the fresh one. `.dockerignore` prevents it; the failure would otherwise appear at runtime, far from its cause |

### 11.3 Verified locally before deploying

The image was built and run against the real Atlas cluster and the real Cloudinary account before the branch was pushed:

```
/health              -> {"status":"ok","dependencies":{"database":"up","storage":"up"}}
/api/v1/health       -> 404   (the version prefix correctly excludes it)
/api/v1/dashboard    -> 401   (unauthenticated)
image contents       -> no vite, no .vite, no apps/web sources
```

CI now builds the image on every pull request and boots it with no configuration, asserting it reaches environment validation. That proves the whole module graph loaded — every Nest module, every Mongoose schema, and the compiled contracts package resolved through its workspace symlink. Both failures above were invisible to the other gates, because those run a full install on a normal filesystem, which is not what ships.
