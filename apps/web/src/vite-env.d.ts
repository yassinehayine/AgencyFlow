/// <reference types="vite/client" />

/**
 * Typed build-time environment.
 *
 * `vite/client` types `import.meta.env` with an index signature, so an unknown
 * variable reads as `any` and silently escapes type checking. Declaring the
 * variables we actually use turns a typo into a compile error.
 */
interface ImportMetaEnv {
  /**
   * Origin of the API, WITHOUT a trailing slash — e.g.
   * `https://agencyflow-api.up.railway.app`.
   *
   * Left empty in development: the Vite dev server proxies `/api` and `/health`
   * to localhost:3000, so a same-origin relative path is correct there. In
   * production the web client is on Vercel and the API on Railway (ADR-0006),
   * which are different origins, so the value is mandatory
   * (docs/DEPLOYMENT.md).
   */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
