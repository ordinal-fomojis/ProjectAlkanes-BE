# Copilot Coding Agent Onboarding Guide

This guide equips an automated coding agent to work efficiently in this repository and avoid CI/build pitfalls. Trust these instructions first; only search if something here seems incomplete or contradicts reality.

## What this repo is
- Backend API for the Project Alkanes ecosystem (aka Shovel Backend).
- Node.js + Express with TypeScript; MongoDB for persistence; strong validation and security middleware.
- Size: small-to-medium TypeScript service with integration and unit tests.
- Key tech: Node 22.x (CI), npm, Express 5, TypeScript 5, Vitest, ESLint, MongoDB driver, OpenTelemetry (optional at runtime).

## High-level layout
- Entry point: `src/index.ts` (Express app, route wiring, health endpoint, DB connect, graceful shutdown).
- Config/env:
  - `src/config/env.ts` loads env via `@dotenvx/dotenvx`. In tests, it loads `.env.sample` automatically. In dev/prod, use `DOTENV_PATH` or project-level `.env`.
  - `src/config/env-vars.ts` exposes typed getter functions for required env. Many are mandatory and validated with `zod`.
- Database: `src/database/` manages Mongo connection and index initialization (`indexes.ts`).
- Middleware: `src/middleware/` includes security headers, validation, referral gate.
- Routes: `src/routes/*` organized by feature (users, referral, points, transactions, tokens, portfolio, fees, activity).
- Services: `src/services/*` business logic (PointsService, ReferralService, FeeService, etc.).
- Instrumentation: `src/instrumentation/*` OpenTelemetry setup and tracing helpers.
- Tests: `tests/` vitest setup and integration suites; uses `mongodb-memory-server` for DB in tests.
- Tooling config: `eslint.config.ts`, `vitest.config.ts`, `tsconfig.json`, `tests/tsconfig.json`.
- Docs: `docs/` security, testing summary, tiers.

## CI and pre-merge checks
GitHub Actions run on PRs and must pass:
1. Typecheck tests: `tsc -p tests`
2. Lint: `npm run lint -- --max-warnings 0`
3. Build: `npm run build`
4. Tests: `npm test`

Runner uses Node 22.x with npm cache. Any PR must pass these in this order. Mirror this locally before pushing.

## Bootstrap and environment
Always do these steps before building or testing:
1. Install dependencies:
   ```bash
   npm install
   ```
2. Environment variables:
   - For tests, nothing extra is required; `ENV` loads `.env.sample` automatically.
   - For local dev/run, create a real env file and point `DOTENV_PATH` to it, or place a root `.env`. A starter is provided at `.env.sample`.
   - Required env (see `src/config/env-vars.ts`): `MONGODB_URI`, `MONGODB_DB_NAME`, `BITCOIN_NETWORK`, `UNISAT_API_KEY`, `SANDSHREW_API_KEY`, `MEMPOOL_API_URL`, `RECEIVE_ADDRESS`, `ENCRYPTION_KEY`, plus rate limit/CORS options, etc. Missing required vars will throw at startup.
   - The repo also maintains multiple env files in `env/` (e.g., `.env.dev`, `.env.prod`, `.env.testnet`, `.env.mock`). Use `DOTENV_PATH=env/.env.dev` to select.
3. Optional: to set or decrypt env via plop:
   ```bash
   npm run plop
   # choose "set-env-variable" or "decrypt-env"
   ```

## Build, run, test, lint
Commands below match package scripts and CI; run them in this order when validating changes.

- Clean (optional, before a full rebuild):
  ```bash
  npm run clean
  ```

- Lint:
  ```bash
  npm run lint
  ```
  Notes: ESLint is configured via `eslint.config.ts` for `src/**/*.ts`. CI enforces zero warnings.

- Typecheck tests (as CI does):
  ```bash
  npx tsc -p tests
  ```

- Build:
  ```bash
  npm run build
  ```
  Output goes to `dist/`. The build is TypeScript-only (`tsc`) with `module`/`moduleResolution` set to `NodeNext`.

- Run in dev (hot reload with tsx + nodemon):
  ```bash
  npm run dev
  ```
  Preconditions: provide valid env; MongoDB must be reachable. Port defaults to 8080. CORS/rate limits configured by env.

- Run in production mode (compiled JS + instrumentation):
  ```bash
  npm run start
  ```
  Preconditions: built artifacts in `dist/` and valid env. Uses `--import=./dist/instrumentation/setup.js` to enable OpenTelemetry.

- Tests (Vitest):
  ```bash
  npm test
  ```
  Notes: Integration tests spin up `mongodb-memory-server` and do not require a live Mongo. `tests/setup.ts` configures fetch mocks and timers. Coverage available with `npm run test:coverage`.

## Common pitfalls and mitigations
- Node version mismatch: CI uses Node 22.x. Use Node 22 locally to avoid subtle ESM/NodeNext differences.
- Env loading: During tests, `ENV` loads `.env.sample`. For dev/prod, set `DOTENV_PATH` or create `.env`. Missing required env will cause runtime errors when starting the server, not during build.
- Database indexing: By default, indexes initialize unless `NODE_ENV=development` and `INITIALISE_INDEXES=false`. In tests and production, indexes are initialized.
- ESM/TypeScript: Project uses ESM (`"type": "module"`) and `NodeNext` resolution. Import compiled JS in `dist/` at runtime; use `.js` extensions in TypeScript source imports (already enforced).
- Lint scope: Only `src/` is linted; adjust changes accordingly to satisfy rules (unused vars, consistent type definitions rule disabled).

## How to validate a change before opening a PR
Always run, in order:
```bash
npm install
npx tsc -p tests
npm run lint -- --max-warnings 0
npm run build
npm test
```
All must pass locally. If you change tests or add new ones, ensure `tests/tsconfig.json` is still valid and `npx tsc -p tests` succeeds.

## Architecture quick map
- HTTP: `src/index.ts` wires middleware and routes and starts the server; see health at `/api/health` and info at `/api`.
- Security: `helmet`, custom headers, content-type validation, rate limiting behind env flags, CORS via regex from `CORS_ORIGIN`.
- Services encapsulate logic; routes/controllers are thin. If adding features, prefer creating a service in `src/services/` and a route under `src/routes/`.
- Database: `src/database/database.ts` exposes `database.getDb()` and a `withTransaction` helper. Indexes live in `src/database/indexes.ts`.
- Instrumentation: tracing helpers in `src/instrumentation/span.ts`; setup in `src/instrumentation/setup.ts`.

## Repo root files of note
- `package.json` (scripts, deps), `tsconfig.json`, `eslint.config.ts`, `vitest.config.ts`.
- `README.md` with quick start and API overview.
- `.github/workflows/test.yaml` (PR checks) and `.github/workflows/deploy.yaml` (build + deploy; prunes dev deps after build).

## Explicit validations reproduced here
- Verified locally on macOS with Node v22.18.0 / npm 10:
  - `npm install` — OK (~2s)
  - `npm run lint` — OK
  - `npx tsc -p tests` — OK
  - `npm run build` — OK
  - `npm test` — OK (Vitest runs; Mongo memory server used). Timing varies; typical <5s locally. Use `--coverage` for report.

## Final guidance for agents
- Prefer the documented commands and order above. Only search the repo if something here fails or appears out-of-date.
- Keep changes minimal and respect existing structure and ESM/TypeScript conventions.
- When adding env vars or config, update `src/config/env-vars.ts`, `.env.sample`, and docs/tests as needed, and ensure CI scripts still pass.
