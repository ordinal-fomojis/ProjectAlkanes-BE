# Shovel Backend

Backend API for [Shovel](https://shovel.space), a platform for minting Alkane and BRC20 tokens on the Bitcoin blockchain. Built with Express 5, TypeScript, and MongoDB.

## Related Repositories

- [Frontend (Next.js)](https://github.com/ordinal-fomojis/ProjectAlkanes-FE)
- [Cron Jobs (Azure Functions)](https://github.com/ordinal-fomojis/ProjectAlkanes-Jobs)
- [Infrastructure (Terraform/K8s)](https://github.com/ordinal-fomojis/ProjectAlkanes-IAC)

## Tech Stack

- **Runtime:** Node.js 22
- **Framework:** Express 5
- **Language:** TypeScript 5 (ESM with `NodeNext` resolution)
- **Database:** MongoDB 7
- **Validation:** Zod
- **Observability:** OpenTelemetry (tracing)
- **Testing:** Vitest + mongodb-memory-server
- **Linting:** ESLint
- **Container:** Docker (Node 24 base image)
- **Deployment:** AKS via ArgoCD (GitOps)

## Project Structure

```
src/
├── config/                # Environment variables and app constants
├── database/              # MongoDB connection, collections and index definitions
├── instrumentation/       # OpenTelemetry tracing setup and helpers
├── middleware/             # Express middleware (auth, security, rate limiting, validation)
├── models/                # Data models
├── routes/                # Express route handlers, organized by feature
├── services/              # Database operations (one service per collection)
├── utils/                 # Utility functions, business logic, RPC helpers
│   ├── rpc/               # Bitcoin RPC utilities
│   ├── transaction/       # Transaction building and signing
│   ├── unisat/            # Unisat API integration
│   └── wif/               # WIF key utilities
└── index.ts               # App entry point

tests/                     # Vitest tests mirroring src/ structure
├── test-utils/            # Mock data and test helpers
├── integration/           # End-to-end integration tests
└── ...

docs/                      # Additional documentation
env/                       # Per-environment .env files (encrypted via dotenvx)
perf/                      # k6 performance tests
.github/
├── workflows/
│   ├── test.yaml          # PR checks (typecheck, lint, build, test)
│   └── build-and-deploy.yaml  # Docker build + deploy to AKS
├── scripts/
│   └── update-image-tag/  # Bumps image tag in IaC repo values
└── dependabot.yaml        # Daily npm dependency updates
```

## API Routes

All routes are prefixed with `/api`.

| Route | Description |
|---|---|
| `GET /api` | API info and version |
| `GET /api/health` | Health check (includes DB connectivity) |
| `/api/users` | User management |
| `/api/auth` | Authentication (JWT-based, BIP-322 signature verification) |
| `/api/referral` | Referral system |
| `/api/alkane/token` | Alkane token queries and search |
| `/api/brc/token` | BRC20 token queries and search |
| `/api/alkane/tx` | Alkane mint transactions |
| `/api/brc/tx` | BRC20 mint transactions |
| `/api/transaction` | Transaction confirmation tracking |
| `/api/fees` | Bitcoin fee estimation |
| `/api/points` | Points and tier system |
| `/api/activity` | User activity feed |
| `/api/portfolio` | Portfolio tracking |

## Prerequisites

- Node.js 22.x
- npm
- MongoDB instance (local or remote)
- API keys for Sandshrew, Unisat

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Initialize environment

```bash
npm run init
```

This pulls the non-production `dotenvx` private keys from Azure Key Vault and creates a local `.env` file based on the `dev` environment. See [docs/ENVIRONMENT_VARS.md](docs/ENVIRONMENT_VARS.md) for details.

If you don't have Key Vault access, you can manually create a `.env` file using [.env.sample](.env.sample) as a reference.

### 3. Run the development server

```bash
npm run dev
```

This starts the server with `nodemon` and `tsx` for hot reloading.

To run against a specific environment:

```bash
npm run dev:dev       # Non-prod dev environment
npm run dev:mock      # Mocked Bitcoin interactions
npm run dev:testnet   # Bitcoin testnet
```

### 4. Run the compiled server

```bash
npm run build
npm start
```

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start dev server with hot reload (nodemon + tsx) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled app with OpenTelemetry instrumentation |
| `npm test` | Run Vitest test suite |
| `npm run test:coverage` | Run tests with Istanbul coverage and open report |
| `npm run lint` | Run ESLint |
| `npm run clean` | Remove `dist/` directory |
| `npm run plop` | Run generators (env variable management, init) |
| `npm run init` | Initialize environment (pull keys, create `.env`) |

## Environment Variables

Environment configuration is managed via `dotenvx` with encrypted `.env` files per environment in the `env/` directory.

| Variable | Description |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `MONGODB_DB_NAME` | Database name |
| `SANDSHREW_API_KEY` | Sandshrew API key for Bitcoin RPC |
| `UNISAT_API_KEY` | Unisat API key |
| `MEMPOOL_API_URL` | Mempool API base URL |
| `RECEIVE_ADDRESS` | BTC receive address for minting fees |
| `ENCRYPTION_KEY` | Encryption key for sensitive data |
| `BITCOIN_NETWORK` | `mainnet`, `testnet`, or `signet` (default: `mainnet`) |
| `PORT` | Server port (default: `8080`) |
| `CORS_ORIGIN` | Regex for allowed CORS origins |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window in ms (default: `900000`) |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window (default: `500`) |
| `JWT_SECRET` | Secret for JWT signing |
| `JWT_EXPIRES_IN` | JWT expiry (default: `24h`) |
| `MOCK_BTC` | Enable mocked Bitcoin interactions (`true`/`false`) |
| `INITIALISE_INDEXES` | Create MongoDB indexes on startup (`true`/`false`) |
| `APP_ENV` | Environment identifier (`prod`, `stage`, `dev`, `mock`, `testnet`, `local`) |

See [docs/ENVIRONMENT_VARS.md](docs/ENVIRONMENT_VARS.md) for full details on managing environment variables.

## Environments

| Environment | Database | Description |
|---|---|---|
| `prod` | Production | Live production at `api.shovel.space` |
| `stage` | Production | Staging slot for final pre-prod validation |
| `dev` | Non-prod | Standard development environment |
| `mock` | Non-prod | Mocked Bitcoin interactions for testing |
| `testnet` | Non-prod | Bitcoin testnet (not yet implemented) |
| `local` | Developer's choice | Local development |

See [docs/ENVIRONMENTS.md](docs/ENVIRONMENTS.md) for deployment details.

## Testing

```bash
# Full CI check sequence
tsc -p tests
npm run lint -- --max-warnings 0
npm run build
npm test
```

Tests use `mongodb-memory-server` to provide an isolated in-memory MongoDB instance per test file. Run `npm test` to execute the full suite, or target specific files:

```bash
npx vitest run tests/services/PointsService.test.ts
```

## GitHub Actions

### Test Workflow ([test.yaml](.github/workflows/test.yaml))

**Trigger:** Pull requests, manual dispatch

Runs the full CI check sequence on Node 22.x:

1. `tsc -p tests` — Typecheck test files
2. `npm run lint -- --max-warnings 0` — Lint with zero warnings
3. `npm run build` — Compile TypeScript
4. `npm test` — Run Vitest suite

### Build and Deploy Workflow ([build-and-deploy.yaml](.github/workflows/build-and-deploy.yaml))

**Trigger:** Push to `main`, manual dispatch

What it does:

1. Logs into Azure and reads Terraform outputs from the IaC repo for ACR details
2. Builds the Docker image and pushes it to Azure Container Registry (with GitHub Actions cache)
3. Runs a Python script to update the image tag in the IaC repo's Helm values
4. Creates an auto-merging PR in the IaC repo, which triggers ArgoCD to deploy

**Manual dispatch inputs:**
- `id` — IaC deployment identifier (blank for default prod)
- `env` — Target environment (`nonprod`, `stage`, or `prod`)

On push to `main`, deploys to non-prod by default. Production deployments must be manually triggered.

### Dependabot ([dependabot.yaml](.github/dependabot.yaml))

Checks for npm dependency updates daily, grouping all updates into a single PR.

## Further Documentation

- [Environment Variables](docs/ENVIRONMENT_VARS.md) — Managing and encrypting env vars
- [Environments](docs/ENVIRONMENTS.md) — Environment details and deployment
- [Security](docs/SECURITY.md) — Security measures and middleware
- [Referral Gate](docs/REFERRAL_GATE.md) — Referral system documentation
- [Tier System](docs/TIER_SYSTEM_UPDATE.md) — Points and tier system
- [Testing Summary](docs/TESTING_SUMMARY.md) — Test coverage overview
