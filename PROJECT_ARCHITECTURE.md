# Observable Crypto Analytics Platform

This document explains how the project works, why the stack was chosen, and what each important file does.

The repo is split into three layers:

1. `src/` is the main TypeScript backend.
2. `frontend/` is the Next.js UI.
3. The root-level Docker and observability files define PostgreSQL, Redis, Prometheus, Alertmanager, Loki, Tempo, Node Exporter, and Grafana.

## High-Level Flow

1. The user opens the frontend in Next.js.
2. The frontend stores a JWT in `localStorage` after login.
3. API calls go to the Express backend on port `3030`.
4. The backend authenticates the request, writes audit/security data to PostgreSQL, and reads cached data from Redis when possible.
5. Business metrics are exported on `/metrics` for Prometheus.
6. Logs are written to the console and to Loki.
7. Traces are sent through OpenTelemetry to Tempo.
8. Grafana reads Prometheus, Loki, and Tempo and shows the system in one place.

## Why These Services Exist

### PostgreSQL on port 5432

PostgreSQL is the system of record.

It stores:

- Users
- Wallets
- Audit logs
- Security events
- Portfolio snapshots

Why PostgreSQL was used:

- The app has relational data.
- Wallets belong to users.
- Audit logs optionally belong to users.
- Portfolio snapshots belong to wallets.
- Prisma makes schema changes predictable through migrations.
- Transactions and foreign keys matter here more than raw document flexibility.

The Prisma schema lives in [`prisma/schema.prisma`](./prisma/schema.prisma). The migrations in `prisma/migrations/` show how the schema evolved:

- Initial user, wallet, audit, and security tables
- Addition of portfolio snapshots
- Cascade delete behavior for snapshots when a wallet is removed

### Redis on port 6379

Redis is used for two separate jobs:

1. Cache
2. Queue backend

Why Redis was used:

- Price lookups are repeated often and should not hit external APIs every time.
- ETH balance lookups can also be cached for short periods.
- BullMQ uses Redis as its queue backend for scheduled portfolio refresh jobs.
- Redis is fast, simple, and suited to short-lived data.

The code uses Redis in:

- [`src/db.ts`](./src/db.ts)
- [`src/services/priceService.ts`](./src/services/priceService.ts)
- [`src/services/portfolioService.ts`](./src/services/portfolioService.ts)
- [`src/queues/portfolioQueue.ts`](./src/queues/portfolioQueue.ts)
- [`src/workers/portfolioWorker.ts`](./src/workers/portfolioWorker.ts)

### Prometheus on port 9090

Prometheus scrapes metrics from the backend and Node Exporter.

Why Prometheus was used:

- The app exports custom business metrics and request metrics.
- Prometheus can scrape them on a schedule.
- Alert rules can fire when request volume or latency crosses a threshold.
- It is the metrics backbone for Grafana dashboards and alerting.

Relevant files:

- [`src/metrics.ts`](./src/metrics.ts)
- [`src/middlewares/metricsMiddleware.ts`](./src/middlewares/metricsMiddleware.ts)
- [`src/routes/metrics.ts`](./src/routes/metrics.ts)
- [`prometheus-config.yml`](./prometheus-config.yml)
- [`alert.rules.yml`](./alert.rules.yml)

### Alertmanager on port 9093

Alertmanager receives firing alerts from Prometheus and routes them onward.

Why Alertmanager was used:

- Prometheus detects alert conditions.
- Alertmanager groups, deduplicates, and routes them.
- This repo is configured to send alerts to Slack and email.

Relevant files:

- [`alertmanager.yml`](./alertmanager.yml)

### Loki on port 3100

Loki stores structured application logs.

Why Loki was used:

- The backend already emits JSON logs through Winston.
- Loki is designed for log aggregation and query.
- Grafana can query Loki alongside Prometheus and Tempo.

Relevant files:

- [`src/logger.ts`](./src/logger.ts)
- [`grafana-datasources.yml`](./grafana-datasources.yml)

### Tempo on port 3200

Tempo stores distributed traces.

Why Tempo was used:

- The backend is instrumented with OpenTelemetry.
- Traces show how a request moves through HTTP, Express, PostgreSQL, Redis, and Prisma.
- This makes latency and dependency issues much easier to debug.

Relevant files:

- [`src/tracing.ts`](./src/tracing.ts)
- [`tempo-config.yaml`](./tempo-config.yaml)
- [`grafana-datasources.yml`](./grafana-datasources.yml)

### Node Exporter on port 9100

Node Exporter publishes host-level metrics.

Why Node Exporter was used:

- It gives visibility into the machine or container host itself.
- You can compare application issues with CPU, memory, and filesystem pressure.
- It is not app-specific; it is infrastructure telemetry.

Relevant files:

- [`docker-compose.yml`](./docker-compose.yml)
- [`prometheus-config.yml`](./prometheus-config.yml)

### Grafana on port 3000

Grafana is the visualization layer.

Why Grafana was used:

- It can read Prometheus, Loki, and Tempo from one UI.
- It is the operator-facing control surface for the platform.
- This repo provisions datasources and a default dashboard automatically.

Relevant files:

- [`grafana-datasources.yml`](./grafana-datasources.yml)
- [`grafana-dashboards.yml`](./grafana-dashboards.yml)
- [`grafana-dashboard.json`](./grafana-dashboard.json)

## Main Runtime Components

### `src/index.ts`

This is the backend entrypoint.

What it does:

- Loads environment variables with `dotenv`
- Connects to PostgreSQL and Redis
- Schedules recurring portfolio refresh jobs
- Starts the Express server
- Starts the portfolio worker by importing it

Why it matters:

- Nothing meaningful should start until the databases are reachable.
- Background jobs need to exist before the API begins serving traffic.

### `src/app.ts`

This builds the Express application.

What it does:

- Installs `helmet`
- Enables CORS
- Parses JSON bodies
- Adds the request metrics middleware
- Applies the global API rate limiter
- Mounts all routes
- Installs the error handler

Route groups:

- `/api/auth`
- `/api/wallets`
- `/api/portfolio`
- `/health`, `/live`, `/ready`
- `/metrics`

Why it is separated from `src/index.ts`:

- `app.ts` is only the HTTP configuration.
- `index.ts` is the process bootstrapper.
- This separation keeps server startup logic out of request wiring.

### `src/db.ts`

This is the shared database and cache connection module.

What it does:

- Creates the Prisma client
- Creates the Redis client
- Connects to PostgreSQL
- Connects to Redis

Why it is separate:

- Every service needs the same connections.
- Centralizing them avoids duplicate connection logic.

### `src/tracing.ts`

This configures OpenTelemetry.

What it does:

- Starts a Node SDK
- Sets the service name to `crypto-analytics-api`
- Installs HTTP, Express, PostgreSQL, Redis, and Prisma instrumentations
- Exports traces to Tempo over OTLP HTTP

Why it matters:

- It gives end-to-end trace visibility without manually instrumenting every call.

### `src/logger.ts`

This defines the logger.

What it does:

- Uses Winston for structured JSON logging
- Logs to the console
- Sends logs to Loki through `winston-loki`

Why it matters:

- Logs are searchable and structured.
- The same logger can be used for app events, errors, and security events.

### `src/metrics.ts`

This defines all Prometheus metrics used by the backend.

Metrics include:

- `http_request_duration_seconds`
- `http_requests_total`
- `login_attempts_total`
- `login_failures_total`
- `wallet_lookup_total`
- `portfolio_requests_total`
- `portfolio_refresh_total`
- `portfolio_refresh_failures_total`
- `ai_analysis_requests_total`
- `ai_analysis_latency_seconds`
- `cache_hits_total`
- `cache_misses_total`
- `external_api_latency`
- `db_query_duration`

Why it matters:

- The metrics are not just infrastructure metrics.
- They track business behavior, cache behavior, API latency, and AI usage.

### `src/middlewares/metricsMiddleware.ts`

This middleware measures every request.

What it does:

- Starts a timer before the route runs
- Observes duration on `finish`
- Increments the total request counter

Why it matters:

- It creates request-level observability without modifying each handler.

### `src/middlewares/auth.ts`

This protects private routes.

What it does:

- Reads the `Authorization: Bearer <token>` header
- Verifies the JWT
- Attaches the decoded user to the request

Why it matters:

- Wallet and portfolio routes must be tied to a real user.
- Unauthorized and forbidden access attempts are logged.

### `src/middlewares/rateLimiter.ts`

This defines two limiters:

- `apiLimiter` for general API traffic
- `loginLimiter` for login brute-force control

Why it matters:

- It reduces abuse and protects the auth endpoint from repeated guessing.

### `src/middlewares/errorHandler.ts`

This is the final error handler.

What it does:

- Logs the error with stack, path, method, and IP
- Returns a sanitized JSON error response

Why it matters:

- Prevents raw stack traces from leaking to clients.

## Backend Routes

### `src/routes/auth.ts`

Handles registration and login.

Registration flow:

1. Validate email and password with Zod
2. Hash the password with bcrypt
3. Save the user in PostgreSQL
4. Write an audit log

Login flow:

1. Validate the payload
2. Look up the user by email
3. Compare the password with bcrypt
4. Sign a JWT
5. Record the login in the audit log

Why it is designed this way:

- Passwords are never stored in plain text.
- Authentication is stateless after token creation.
- Audit logging creates a forensic trail.

### `src/routes/wallet.ts`

Handles wallet CRUD.

What it does:

- Requires authentication on every route
- Adds a wallet
- Lists the current user’s wallets
- Deletes a wallet

Why it matters:

- Wallets are private user data.
- Ownership checks happen in service logic and through auth.

### `src/routes/portfolio.ts`

This is the analytics route set.

What it does:

- Returns current portfolio value
- Returns historical portfolio snapshots
- Returns performance over the last two snapshots
- Returns AI-style portfolio insights

Why it is important:

- This is where operational data becomes portfolio intelligence.
- It touches the database, Redis, tracing, metrics, and the AI abstraction.

### `src/routes/health.ts`

Provides health checks.

Endpoints:

- `/health`
- `/live`
- `/ready`

Why it matters:

- `/ready` checks both PostgreSQL and Redis.
- This is useful for orchestration and deployment health checks.

### `src/routes/metrics.ts`

Exposes Prometheus metrics.

What it does:

- Returns the registry in Prometheus text format

Why it matters:

- Prometheus scrapes this endpoint on a schedule.

## Services

### `src/services/authService.ts`

Contains register and login business logic.

Why it exists:

- Routes stay thin.
- Authentication logic stays reusable and testable.

### `src/services/walletService.ts`

Handles wallet persistence and validation.

What it does:

- Validates Ethereum addresses for Ethereum wallets
- Creates wallets in PostgreSQL
- Reads wallets for a user
- Deletes wallets

Why it matters:

- Network-specific validation prevents bad data early.

### `src/services/portfolioService.ts`

This is the core analytics service.

What it does:

- Fetches wallets for a user
- Reads cached balances from Redis
- Falls back to live blockchain and price APIs
- Computes total portfolio value
- Writes portfolio snapshots to PostgreSQL
- Returns history and performance data
- Builds wallet data for AI analysis

Why it exists:

- It centralizes portfolio computation so routes do not contain business logic.

Important implementation details:

- ETH balance is cached for 300 seconds.
- CoinGecko price data is cached for 300 seconds.
- USDT token balance is fetched from Etherscan.
- Every portfolio calculation writes a snapshot to the database.

### `src/services/priceService.ts`

Fetches coin prices.

What it does:

- Reads `price:<coinId>` from Redis
- Fetches from CoinGecko on cache miss
- Stores fresh values back in Redis for 5 minutes

Why it matters:

- External price APIs are slower and rate-limited.
- Caching reduces cost and latency.

### `src/services/securityService.ts`

Writes security and audit records.

What it does:

- Logs security events
- Logs audit events
- Writes them to PostgreSQL
- Also logs them through Winston

Why it matters:

- You get both durable storage and centralized logs.

### `src/services/ai/index.ts`

Registers the AI analyzer implementation with `tsyringe`.

Current behavior:

- Uses `DeterministicAnalyzer`
- `LLMAnalyzer` is present as a stub for future replacement

Why it matters:

- The app can swap analysis implementations later without changing the route contract.

### `src/services/ai/AIAnalyzer.ts`

Defines the analyzer interface and output shape.

Why it matters:

- Keeps the contract explicit.
- Makes the portfolio route independent from any specific AI engine.

### `src/services/ai/DeterministicAnalyzer.ts`

Provides the current analysis logic.

What it does:

- Computes risk, diversification, concentration, and stablecoin exposure
- Generates human-readable insights

Why it exists:

- It gives deterministic output for testing and avoids depending on a live model.

### `src/services/ai/LLMAnalyzer.ts`

Stub for future model-backed analysis.

Why it exists:

- It marks the intended extension point for a real language model integration.

### `src/queues/portfolioQueue.ts`

Defines the BullMQ queue and recurring job schedule.

What it does:

- Creates the `portfolio-refresh` queue
- Schedules `refresh-all-wallets` every 15 minutes

Why Redis is required here:

- BullMQ stores queue state in Redis.
- The queue would not work without it.

### `src/workers/portfolioWorker.ts`

Processes recurring portfolio refresh jobs.

What it does:

- Loads all users
- Recomputes each user’s portfolio
- Logs success or failure per user

Why it matters:

- This keeps portfolio snapshots fresh even when nobody is actively viewing the UI.

## Frontend

### `frontend/app/layout.tsx`

Root layout for the Next.js app.

What it does:

- Loads global CSS
- Defines HTML structure and metadata
- Wraps every page in a `main` element

### `frontend/app/page.tsx`

Entry redirect page.

What it does:

- Checks `localStorage` for a token
- Sends authenticated users to `/dashboard`
- Sends unauthenticated users to `/login`

Why it exists:

- It keeps the first screen minimal and session-aware.

### `frontend/app/login/page.tsx`

Auth screen.

What it does:

- Switches between login and registration modes
- Calls the backend auth endpoints
- Stores the JWT on success
- Redirects into the dashboard

### `frontend/app/dashboard/page.tsx`

Main application UI.

What it does:

- Loads wallets and portfolio totals
- Lets the user add or delete wallets
- Loads historical balances
- Loads portfolio insights
- Displays charts and wallet details
- Logs the user out by clearing the token

Why it exists:

- It is the operational view of the platform.
- It turns backend telemetry and portfolio data into something usable.

### `frontend/services/api.ts`

Small fetch wrapper for the frontend.

What it does:

- Points at `http://localhost:3030/api`
- Adds the JWT from `localStorage`
- Handles JSON requests and response errors

Why it matters:

- It keeps backend calls consistent across the UI.

### `frontend/src/instrumentation.ts`

Empty Next.js instrumentation hook.

Why it exists:

- Next.js can look for this file during dev startup.
- Keeping the hook in place avoids missing-module startup errors.

### `frontend/app/globals.css`

Global styles for the Next.js app.

What it does:

- Defines the black-and-white visual theme
- Sets shared font, spacing, and container styles
- Provides the `fade-in` animation and monospace class

### `frontend/app/login/login.module.css`

Scoped login page styles.

### `frontend/app/dashboard/dashboard.module.css`

Scoped dashboard styles.

### `frontend/package.json`

Frontend dependency and script definition.

What it does:

- Runs the Next.js dev server on port `3005`
- Uses the current React, Next, and Recharts stack

## Root-Level Infrastructure Files

### `docker-compose.yml`

This is the infra orchestration file.

It starts:

- PostgreSQL on `5432`
- Redis on `6379`
- Prometheus on `9090`
- Alertmanager on `9093`
- Loki on `3100`
- Tempo on `3200`
- Node Exporter on `9100`
- Grafana on `3000`

Why Docker Compose is used:

- The stack is easier to run locally as one unit.
- Service dependencies are explicit.
- Ports are consistent and easy to remember.

### `prometheus-config.yml`

Prometheus scrape configuration.

It scrapes:

- Prometheus itself
- The backend application on `host.docker.internal:3030`
- Node Exporter on `node-exporter:9100`

It also wires Alertmanager into Prometheus.

### `alert.rules.yml`

Defines Prometheus alert rules.

Current alerts:

- `HighRequestRate`
- `InvalidEndpointHit`
- `SlowEndpointLatency`

Why these rules matter:

- They detect traffic spikes.
- They detect invalid endpoint abuse.
- They detect rising execution latency.

### `alertmanager.yml`

Defines alert routing.

What it does:

- Groups alerts by name
- Routes them to a receiver called `notify-all`
- Provides Slack and email notification stubs

### `grafana-datasources.yml`

Auto-provisions Grafana datasources.

It points Grafana at:

- Prometheus
- Loki
- Tempo

### `grafana-dashboards.yml`

Auto-provisions the dashboard directory.

### `grafana-dashboard.json`

Default dashboard definition loaded into Grafana.

### `tempo-config.yaml`

Tempo configuration.

What it does:

- Listens on port `3200`
- Accepts OTLP HTTP traces on `4318`
- Stores traces locally inside the container

### `app.js`

A separate standalone Express script in the root.

What it does:

- Exposes simple `/fast`, `/slow`, `/invalid`, and `/metrics` endpoints
- Uses `prom-client`
- Runs on port `3030`

Important note:

- This file is not the main TypeScript backend entrypoint.
- The actual application backend is `src/index.ts`.
- `app.js` looks like a lightweight metrics demo or legacy sample server that overlaps with the backend port, so it should not be confused with the main API.

### `package.json`

Root backend package definition.

Scripts:

- `dev` runs the instrumented TypeScript backend
- `build` compiles to `dist`
- `start` runs the compiled app with tracing enabled
- `prisma:*` handles schema generation and migrations
- `test` runs Jest

### `tsconfig.json`

TypeScript configuration for the backend.

Why these settings matter:

- `rootDir` and `outDir` separate source from build output
- `strict` keeps the backend type-safe
- `experimentalDecorators` and `emitDecoratorMetadata` are needed for `tsyringe`

### `jest.config.js`

Test configuration for the backend.

What it does:

- Uses `ts-jest`
- Runs tests in a Node environment

### `README.md`

Top-level project summary.

### `EXECUTION_GUIDE.md`

Step-by-step runbook for the stack.

It explains:

- Docker startup
- Backend startup
- Frontend startup
- Manual testing
- Observability checks

## Data Model

### `User`

Stores:

- `id`
- `email`
- `password`
- timestamps

Relationships:

- One user has many wallets
- One user has many audit logs

### `Wallet`

Stores:

- `address`
- `network`
- owning `userId`
- timestamps

Relationships:

- Belongs to one user
- Has many portfolio snapshots

Constraint:

- `(address, network)` must be unique

### `PortfolioSnapshot`

Stores:

- `walletId`
- `valueUsd`
- `createdAt`

Purpose:

- Gives historical portfolio charts and performance comparisons

### `AuditLog`

Stores:

- `userId`
- `action`
- `details`
- `ip`
- `createdAt`

Purpose:

- Records user actions for traceability and review

### `SecurityEvent`

Stores:

- `eventType`
- `ip`
- `details`
- `createdAt`

Purpose:

- Records suspicious or failed security-related activity

## Why The Architecture Is Split This Way

The project separates concerns cleanly:

- UI concerns stay in Next.js
- Business logic stays in services
- HTTP wiring stays in routes
- Data access stays in Prisma
- Cache and queue concerns stay in Redis
- Metrics stay in Prometheus
- Logs stay in Loki
- Traces stay in Tempo

That separation matters because this is not just a CRUD app. It is a portfolio system with:

- authentication
- caching
- background refresh jobs
- auditability
- observability
- failure visibility

## Practical Notes

- The backend listens on `3030`.
- The frontend listens on `3005`.
- PostgreSQL listens on `5432`.
- Redis listens on `6379`.
- Prometheus listens on `9090`.
- Alertmanager listens on `9093`.
- Loki listens on `3100`.
- Tempo listens on `3200`.
- Node Exporter listens on `9100`.
- Grafana listens on `3000`.

The stack is usable only when the backend, Redis, PostgreSQL, and the observability services agree on those addresses.

