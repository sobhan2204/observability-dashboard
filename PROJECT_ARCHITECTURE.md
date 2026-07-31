---

# OBSERVABLE CRYPTO ANALYTICS PLATFORM

---

<br><br>

## Real-Time Application Monitoring & Observability Engineering

### Using Prometheus, Grafana, Loki, Tempo, Docker & AWS EC2

**Technical Internship Project Report**

<br>

**Project Title**
Design, Implementation, and Operation of a Full-Stack Observability Platform for a Containerized Crypto Portfolio Analytics Application

<br>

**Prepared By**
Sobhan Panda

**Internship Duration**
June 1, 2026 – July 31, 2026

**Organization / Company Name**
LTM

<br>

**Technology Stack Summary**

| Category | Technologies |
|---|---|
| Programming Languages | TypeScript, JavaScript, Python, SQL, Bash |
| Backend Frameworks | Node.js 20, Express 4, FastAPI (Python sidecar) |
| Frontend Framework | Next.js (App Router), React, Recharts, lucide-react |
| Database | PostgreSQL 15 (with `pg_stat_statements`) |
| Caching / Queueing | Redis 7, BullMQ, ioredis |
| ORM | Prisma 5 (with tracing + metrics preview features) |
| Monitoring (Metrics) | Prometheus, prom-client, node-exporter, postgres-exporter, redis-exporter, custom Python exporter |
| Visualization | Grafana (+ Infinity/JSON-API datasource plugin) |
| Logging | Winston, winston-loki, Grafana Loki |
| Distributed Tracing | OpenTelemetry SDK, OTLP/HTTP, Grafana Tempo |
| Alerting | Prometheus Alertmanager, Gmail SMTP |
| Containerization / Orchestration | Docker, Docker Compose (13 services) |
| Cloud / Infrastructure | AWS EC2 (t3.small, `ap-south-1`), AWS Elastic IP, EBS (gp3) |
| Security Libraries | Helmet, CORS, express-rate-limit, bcrypt, jsonwebtoken, Zod |
| Blockchain Integration | ethers.js, Etherscan API, CoinGecko API |
| Dependency Injection | tsyringe, reflect-metadata |
| Testing | Jest, ts-jest |
| Version Control / Deployment | Git, GitHub, SSH, manual `docker compose up -d --build` |

<br><br>

---

# TABLE OF CONTENTS

1. Project Overview
   1.1 Architecture Overview
   1.2 Key Concepts Learned
2. Technology Stack
3. Complete System Architecture
4. Observability Stack
5. Complete Observability Workflow
6. Deployment Architecture
7. Dashboard Documentation
8. Visualization Types
9. Complete PromQL Documentation
10. Custom Metrics Documentation
11. Postgres Custom Exporter Queries
12. API Documentation
13. Database Design
14. Configuration Files
15. Troubleshooting
16. Security Implementation
17. Lessons Learned
18. Future Improvements
19. Appendix

---

# 1. PROJECT OVERVIEW

## Project Background

A single user request to view a crypto portfolio touches a REST API, a relational database, a cache, a background job queue, two external APIs (CoinGecko, Etherscan), and an AI-style analysis engine — any of which can fail or slow down. Traditional debugging (reading logs after the fact) doesn't scale to this kind of distributed, asynchronous system.

The **Observable Crypto Analytics Platform** was built during this internship to solve exactly that problem: a working, deployed crypto portfolio tracker (register/login, add wallets, view portfolio value and history, get AI-generated insights) instrumented end-to-end with metrics, structured logs, and distributed traces — correlated in Grafana, with alerting wired to email. The application itself is the *subject* being observed; the internship's real deliverable is the **observability platform wrapped around it**.

## Problem Statement

**Business problem:** Without observability, production is a black box. When a user reports "the app is slow," a team with no metrics/logs/traces cannot tell *where* the problem is — API, database, cache, external API, or worker — without ad-hoc debugging and redeploys, which means longer downtime and lower trust in a financial-data app.

**Technical problem:** Specific failure-prone points needed visibility: external dependency risk (every portfolio calculation calls Etherscan and CoinGecko); database contention (Prisma's pool is capped at 10 connections); background job reliability (a BullMQ worker refreshes portfolios every 15 minutes — a silent failure means stale data with no user-facing error); security visibility (brute-force logins, endpoint probing); and single-host risk (all 13 containers share one EC2 instance, so resource exhaustion can degrade everything at once).

## Project Objectives

**Business objectives:** reduce MTTD/MTTR for production issues; give a non-engineer or reviewer a single dashboard view of system health in business terms (login failure rate, AI insight latency, external API latency); maintain an auditable trail of security-relevant events; keep the platform cheap to run (~$18/month, one `t3.small`).

**Technical objectives:** instrument the backend with custom Prometheus metrics across HTTP, business logic, database, cache, and AI layers; deploy Prometheus, Grafana, Loki, Tempo, and Alertmanager wired together with zero manual data-copying; build/reuse exporters for every infrastructure component, including a bespoke Python exporter for Redis client detail; implement OpenTelemetry tracing across Express → Prisma → Postgres/Redis → external calls; correlate logs with traces via injected trace/span IDs; define alert rules routed to email; and containerize everything with a single-command Docker Compose stack.

## Project Scope

**In scope:** backend API instrumentation (`prom-client`); the Next.js frontend as the observed client; PostgreSQL observability including query-level detail via `pg_stat_statements`; Redis observability at both server and per-client-connection level; BullMQ observability via application counters; a full Grafana dashboard suite (28 panels across two dashboards); Alertmanager → Gmail SMTP alerting; single-host AWS EC2 deployment via Docker Compose.

## Project Deliverables

| # | Deliverable | Status |
|---|---|---|
| 1 | Instrumented backend API exposing 17+ custom Prometheus metrics | Delivered |
| 2 | Prometheus deployment with 6 scrape jobs and 3 alert rules | Delivered |
| 3 | Grafana "Control Center" dashboard — 23 panels across 6 sections | Delivered |
| 4 | Grafana "Redis Connected Clients" dashboard — 4+1 panels | Delivered |
| 5 | Custom Python/FastAPI Redis client-connection exporter | Delivered |
| 6 | PostgreSQL query-level observability via `pg_stat_statements` + 5 custom exporter queries | Delivered |
| 7 | Centralized logging via Loki with trace-ID correlation | Delivered |
| 8 | Distributed tracing via OpenTelemetry + Tempo | Delivered |
| 9 | Email alerting via Alertmanager + Gmail SMTP | Delivered |
| 10 | Full Docker Compose orchestration (13 services) | Delivered |
| 11 | Production deployment on AWS EC2 with a static Elastic IP | Delivered |
| 12 | Operational runbooks (`PRODUCTION.md`, `PROJECT_ARCHITECTURE.md`, `DATABASE_OBSERVABILITY.md`) | Delivered |

## Expected Outcome and Benefits

A single Grafana screen that answers "is the system healthy right now?" across infrastructure, application, database, and cache layers; the ability to trace a slow request from a panel to logs (Loki) to a trace (Tempo) without leaving the browser; proactive email alerts instead of reactive user reports; and a reproducible one-command deployment.

## Real-World Applications

The patterns here — correlated metrics/logs/traces, exporters for every dependency, alerting to a human-reachable channel — mirror production practice at SaaS companies and any team running SLA-bound services. Directly transferable skills: designing a cardinality-safe metrics taxonomy (a real bug was hit and fixed here, Section 15), building composite health-score panels, and exposing query-level DB performance without leaking literal parameters.

---

## 1.1 ARCHITECTURE OVERVIEW

The platform is a **single-host, Docker Compose–orchestrated microservices architecture**. All thirteen containers run on one AWS EC2 instance (`i-008919cbd197c873a`, `t3.small`, `ap-south-1`), on one internal Docker bridge network, reachable from the internet only via a static Elastic IP (`13.206.106.64`) on two public ports.

![Architecture Overview — full system diagram](diagrams/diagram1_architecture.png)

### 1.1.1 Component-by-Component Explanation

**Frontend (`frontend`, Next.js, port 3005):** A server-rendered React app presenting login, registration, and dashboard views (portfolio value, wallets, history via Recharts). Calls the backend over HTTP/REST (`NEXT_PUBLIC_API_BASE_URL`, baked in at build time). Chosen for fast iteration and built-in routing; it is the sole public entry point alongside the API and generates the real traffic that all downstream telemetry describes.

**Backend API (`app`, Express + TypeScript, port 3030):** The core of the system — owns authentication, wallet management, portfolio valuation, and AI-style insights, and is the most heavily instrumented component. Handles Zod validation, JWT auth, business logic, Prisma database access, Redis caching, and calls to CoinGecko/Etherscan, while emitting metrics/logs/traces. Express was chosen for its lightweight, well-understood model; Prisma for type-safe access with a built-in metrics API; `prom-client` as the standard Node.js Prometheus client. It is the hub: every other component either feeds it or consumes its telemetry.

**PostgreSQL (`db`, port 5432):** The primary relational store (Postgres 15 Alpine) for users, wallets, portfolio snapshots, audit logs, and security events, chosen for relational integrity and because `pg_stat_statements` gives query-level performance visibility essentially for free. Read/written by `app`; scraped by `postgres-exporter`; queried directly by Grafana's Postgres datasource for raw-SQL panels.

**Redis (`redis`, port 6379):** An in-memory store (Redis 7 Alpine) serving two roles — a short-TTL cache for wallet balances/prices, and BullMQ's queue backend. Sub-millisecond reads reduce load on external APIs; the dual purpose keeps the infrastructure footprint small. Read/written by `app`; scraped by `redis-exporter`; polled by the custom `redis-client-monitor`.

**Prometheus (`prometheus`, port 9090):** The pull-based metrics database and alert engine. Scrapes 6 targets every 4 seconds, evaluates 3 alert rules continuously, and serves PromQL to Grafana — the metrics backbone behind nearly every Control Center panel.

**Grafana (`grafana`, port 3000, IP-restricted):** The visualization layer, querying 5 provisioned datasources (Prometheus, Loki, Tempo, Postgres, Infinity/JSON-API) and rendering 28 panels across 2 dashboards. Chosen as the de facto standard for multi-source observability visualization; it's the single pane of glass for every other component's telemetry.

**Loki (`loki`, port 3100):** Central store for structured application logs, ingesting streams pushed by `winston-loki`, indexed only by the label `app: crypto-analytics-api`. Chosen for its low-overhead, label-based indexing (versus full-text) — important on a shared `t3.small`. Queried by Grafana's LOGS panel and cross-linked from Tempo traces.

**Tempo (`tempo`, ports 3200/4318):** The distributed tracing backend, receiving OTLP/HTTP spans from `src/tracing.ts` and storing them locally. Chosen for native OTLP support and tight Grafana integration, including trace-to-log correlation. Receives every span the backend emits, including manual spans like `generate_portfolio_insights`.

**Alertmanager (`alertmanager`, port 9093):** Receives firing alerts from Prometheus, groups them by `alertname`, applies wait/repeat intervals, and sends email via Gmail SMTP. A single email receiver was sufficient at this scale; it sits downstream of Prometheus and upstream of the on-call inbox.

**node-exporter (port 9100):** The official host-metrics exporter — zero-configuration, community-standard — providing CPU/memory/disk/network/load data with no custom code.

**postgres-exporter (port 9187):** The community Postgres exporter, extended with 5 custom SQL collectors, exposing both built-in statistics and project-specific query-level detail (`pg_stat_statements`, lock waits, blocking sessions, running queries, WAL activity).

**redis-exporter (port 9121):** The community Redis exporter, exposing aggregate health — memory, hit ratio, ops/sec, eviction rate.

**redis-client-monitor (custom, Python/FastAPI, port 8001):** A bespoke sidecar filling the one gap `redis-exporter` leaves — per-client detail (IP, username, connection age, idle time). Polls `CLIENT LIST` every 5 seconds. Per-client identity is unbounded-cardinality if used as a Prometheus label, so this service stays label-free in Prometheus and serves the high-cardinality detail via a separate JSON `/clients` endpoint consumed by Grafana's Infinity plugin — a deliberate anti-pattern-avoidance design.

### 1.1.2 Request Flow (Sequence Diagram)

![Request Flow — GET /api/portfolio](diagrams/diagram2_request_flow.png)

## 1.2 KEY CONCEPTS LEARNED

**Monitoring vs. Observability:** Monitoring watches predefined checks against known failure modes ("alert if CPU > 90%") — it answers questions you already knew to ask. Observability is the broader property of letting an engineer ask *new*, unanticipated questions using only external outputs (metrics, logs, traces), without shipping new code. This project practices both: the three alert rules are classic monitoring, while the combination of traces, structured logs, and a rich metrics taxonomy makes the system observable for unexpected issues.

**The Three Pillars:**

| Pillar | What it captures | Tool used here | Best for |
|---|---|---|---|
| Metrics | Numeric time-series (counters, gauges, histograms) | Prometheus + prom-client | Trends, thresholds, alerting, dashboards |
| Logs | Discrete, timestamped, structured event records | Loki + Winston | Detailed context for a specific event/request |
| Traces | End-to-end path/timing of a single request | Tempo + OpenTelemetry | Root-causing latency and cross-service failures |

The real power is **correlation**: every log line carries a `traceId`/`spanId` (via a custom Winston format reading the active OpenTelemetry span), and Grafana's Tempo datasource is configured with `tracesToLogsV2` pointing at Loki — so an engineer can click a slow trace and jump straight to its log lines.

**Metrics types:** *Counter* — only increases (`http_requests_total`), used with `rate()`. *Gauge* — goes up or down (`db_pool_active_connections`), represents current state. *Histogram* — buckets observations with `_sum`/`_count` (`http_request_duration_seconds`), enables `histogram_quantile()`. *Summary* — client-side quantiles rather than bucket aggregation (`ai_analysis_latency_seconds`).

**Infrastructure vs. application monitoring:** Infrastructure monitoring (`node-exporter`) answers "is the machine healthy?"; application monitoring (custom `prom-client` metrics) answers "is my code healthy?" Both are needed since a slow endpoint could stem from either layer — hence Infrastructure Monitoring and Backend Service Monitoring sit in adjacent dashboard rows.

**Prometheus** is pull-based: it scrapes each target's `/metrics` endpoint every 4 seconds (fast, chosen for demo responsiveness on a low-traffic project) rather than targets pushing to a collector. Data is stored as time series keyed by metric name plus labels.

**Grafana** is datasource-agnostic and stores no data itself here — every panel is a live query. Dashboards are provisioned as JSON (`grafana-dashboard.json`, `redis-clients-dashboard.json`), version-controlled alongside the app rather than hand-built in the UI.

**node-exporter** reads `/proc`/`/sys` directly with zero application changes, powering the entire Infrastructure Monitoring row.

**redis-exporter vs. the custom monitor:** `redis-exporter` covers server-wide stats only; it does not expose per-connection detail, which is exactly why the custom `redis-client-monitor` exists — a concrete lesson in choosing a community exporter versus building a small purpose-specific one.

**postgres-exporter and custom queries:** extended with 5 SQL-based collectors, most notably against `pg_stat_statements` — an extension that must be preloaded at Postgres startup (`shared_preload_libraries`), unlike most extensions which activate purely via `CREATE EXTENSION`.

**Loki and structured logging:** Loki indexes only a small label set (`app: crypto-analytics-api`), not full log text — the key difference from Elasticsearch-style systems, keeping its footprint small alongside twelve other containers. Logs are structured JSON, making every field individually queryable.

**Distributed tracing:** a **trace** is one logical request end-to-end; a **span** is one unit of work within it. OpenTelemetry auto-instrumentation covers HTTP, Express, Postgres, Redis, and Prisma with zero manual code; manual spans (`generate_portfolio_insights`, `fetch_eth_balance`, `fetch_token_balances`, `fetch_prices`) add fine-grained visibility into portfolio calculation steps.

**PromQL patterns used:** `rate(counter[5m])` for per-second rate; `histogram_quantile(0.95, sum(rate(histogram_bucket[5m])) by (le))` for P95 latency; `sum by (label)(...)` for per-dimension aggregation; `> bool` composite expressions for the Database Health Score's 0–5 summed signal.

**Cardinality discipline — a concrete lesson:** Prometheus degrades badly with unbounded label values (user IDs, IPs, raw SQL, request IDs). Two decisions here avoid that: `db_query_duration` uses a fixed, small set of call-site name labels rather than raw SQL; and `redis-client-monitor` deliberately keeps per-client IP/username out of Prometheus, serving it instead via a JSON endpoint with no cardinality constraint. A related real incident (Section 15) — a custom `postgres-exporter` query colliding with a built-in collector's metric name and breaking the whole `/metrics` endpoint — was resolved by removing the duplicate.

**Application instrumentation** here takes three forms: `metricsMiddleware` timing every HTTP request globally; manual counters/histograms/timers in service functions; and manual OpenTelemetry spans around meaningful units of work.

**Background workers (BullMQ):** a Redis-backed job queue running one recurring job, `portfolio-refresh` (`*/15 * * * *`), consumed by a `Worker` that recomputes every user's portfolio value — decoupling data freshness from user traffic, tracked via `portfolio_refresh_total`/`_failures_total`.

---
# 2. TECHNOLOGY STACK

## 2.1 Backend Technologies

| Technology | Purpose | Why Used | Advantages | Project Usage |
|---|---|---|---|---|
| Node.js 20 (Alpine) | JavaScript runtime | Lightweight LTS base image | Small image, fast startup | Runs the Express API and worker |
| TypeScript | Typed superset of JS | Type safety for a financial-data app | Compile-time checks, better IDE support | Entire `src/` backend |
| Express 4 | HTTP framework | Minimal, unopinionated | Simple routing, easy to instrument | All REST routes |
| Prisma 5 | Type-safe ORM | Auto-generated types + tracing/metrics preview features | No hand-written SQL, exposes `$metrics` | All DB access; migrations |
| Zod | Schema validation | Runtime validation matching TS types | Fails fast with clear errors | Request body validation |
| bcrypt | Password hashing | Industry-standard adaptive hashing | Resistant to brute-force attacks | Hashing at register/login |
| jsonwebtoken | JWT signing | Stateless auth | No server-side sessions | Login token issuance/verification |
| helmet | Security headers | Sane defaults automatically | Mitigates common web vulns | Applied globally |
| cors | Cross-origin sharing | Frontend on a different port calls the API | Standard middleware | Applied globally |
| express-rate-limit | Rate limiting | Abuse/brute-force mitigation | Simple, per-route configurable | `apiLimiter`, `loginLimiter` |
| ethers.js | Blockchain interaction | Read wallet balances on-chain | Well-maintained, typed | Etherscan balance/token lookups |
| axios | HTTP client | Promise-based requests | Interceptors, timeouts | CoinGecko/Etherscan calls |
| winston | Structured logging | Flexible, multi-transport | JSON formatting, trace-ID injection | `src/logger.ts` |
| winston-loki | Loki transport | Ships logs to Loki directly | No separate shipping agent | Log pipeline |
| prom-client | Prometheus client | Standard Node.js client | Counters/gauges/histograms/summaries | `src/metrics.ts` |
| OpenTelemetry SDK | Tracing | Vendor-neutral auto-instrumentation | Minimal code for broad coverage | `src/tracing.ts`, manual spans |
| tsyringe + reflect-metadata | Dependency injection | Swappable AI analyzer | Decouples routes from concrete class | AI analyzer container |
| Jest + ts-jest | Testing | Standard TS test runner | Fast, well-documented | `src/__tests__/ai.test.ts` |
| BullMQ + ioredis | Job queue | Reliable Redis-backed scheduling | Cron patterns, retry/failure events | Portfolio refresh job |

## 2.2 Frontend Technologies

| Technology | Purpose | Why Used | Advantages | Project Usage |
|---|---|---|---|---|
| Next.js (App Router) | React framework | Modern routing, SSR/CSR flexibility | File-based routing, fast dev server | `frontend/app/` |
| React | UI library | Component-based UI | Huge ecosystem | All frontend components |
| Recharts | Charting | Declarative React charting | Easy React-state integration | Portfolio/performance charts |
| lucide-react | Icons | Consistent, lightweight | Tree-shakeable | UI iconography |
| TypeScript | Static typing | Consistency with backend | Shared mental model | Entire frontend |

## 2.3 Database & Caching Technologies

| Technology | Purpose | Why Used | Advantages | Project Usage |
|---|---|---|---|---|
| PostgreSQL 15 (Alpine) | Primary database | ACID guarantees, rich statistics views | `pg_stat_statements`/`pg_stat_activity` for deep observability | `User`, `Wallet`, `PortfolioSnapshot`, `AuditLog`, `SecurityEvent` |
| Redis 7 (Alpine) | Cache + queue store | Sub-ms reads, native TTL, required by BullMQ | Dual-purpose, smaller footprint | Price/balance cache (5-min TTL); queue storage |

## 2.4 Observability Stack

| Technology | Purpose | Why Used | Advantages | Project Usage |
|---|---|---|---|---|
| Prometheus | Metrics collection/storage/alerting | Pull-based, PromQL, native alerting | Simple ops model, huge exporter ecosystem | 6 scrape targets, 3 alert rules |
| Grafana | Dashboarding | Multi-datasource, dashboard-as-code | Trace-to-log correlation | 2 dashboards, 28 panels, 5 datasources |
| Loki | Log aggregation | Label-based indexing keeps footprint low | Cheaper than full-text indexing | Central log store |
| Tempo | Trace storage | Native OTLP, tight Grafana integration | Correlates with Loki via `tracesToLogsV2` | All backend trace spans |
| Alertmanager | Alert routing | Standard Prometheus companion | Grouping, dedup, silences | Routes 3 rules to email |
| node-exporter | Host metrics | Zero-config standard exporter | CPU/mem/disk/net, no custom code | Infrastructure Monitoring row |
| postgres-exporter | Postgres metrics | Extensible via YAML SQL collectors | Built-in + project-specific metrics | Database Monitoring/Performance rows |
| redis-exporter | Redis server metrics | Standard community exporter | Aggregate health, no custom code | Redis Cache & Queue row |
| redis-client-monitor (custom) | Per-client Redis detail | No existing exporter covers this | Purpose-built, cardinality-safe | Redis Connected Clients dashboard |

## 2.5 Infrastructure & DevOps

| Technology | Purpose | Why Used | Advantages | Project Usage |
|---|---|---|---|---|
| Docker | Containerization | Consistent runtime | Isolated deps, reproducible builds | All 13 services |
| Docker Compose | Orchestration | Declarative single-host definition | One command to run the stack | `docker-compose.yml` |
| AWS EC2 | Cloud compute | Cost-effective single instance | Pay-as-you-go | Hosts the stack (`t3.small`) |
| AWS Elastic IP | Static public IP | Survives instance stop/start | Predictable addressing | Public access point |
| Git / GitHub | Version control | Standard SCM | Collaboration, rollback | Deployment trigger (`git pull`) |

## 2.6 Redis Client Monitor Sidecar (Python)

| Technology | Purpose | Why Used | Advantages | Project Usage |
|---|---|---|---|---|
| Python 3.12 (slim) | Runtime | Fast to write a small poller | Minimal image footprint | `redis-client-monitor` |
| FastAPI | HTTP framework | Modern async Python | Async-friendly, minimal boilerplate | `/metrics`, `/clients`, `/health` |
| uvicorn | ASGI server | Standard FastAPI server | Lightweight, fast | Serves the app |
| prometheus_client (Python) | Metrics exposition | Official Python client | Matches `prom-client` format | Aggregate Redis client metrics |
| redis-py | Redis client | Executes `CLIENT LIST` | Simple, synchronous | `fetch_clients()` |

---
# 3. COMPLETE SYSTEM ARCHITECTURE

## 3.1 Layered View

![Complete System Architecture — Layered View](diagrams/diagram3_layered.png)

## 3.2 Authentication Flow

Authentication is stateless JWT-based. `POST /api/auth/register` hashes the password (bcrypt, cost 10) and stores the user. `POST /api/auth/login` (rate-limited to 5/min/IP) verifies via `bcrypt.compare` and signs a JWT (1-hour expiry, HS256) containing `id`/`email`. Subsequent requests to `/api/wallets/*` and `/api/portfolio/*` pass this as a `Bearer` token, verified by `authenticateToken`. Every register/login/wallet/portfolio-view action is written to `AuditLog`; every failed login is also written to `SecurityEvent`.

## 3.3 Database, Redis, and BullMQ Interaction

**Database:** `PrismaClient` is instantiated once (`src/db.ts`) and shared app-wide. Pooling is entirely Prisma-managed (no raw `pg.Pool`), sized by `connection_limit` on `DATABASE_URL` (10 in production). Pool state is sampled every 5s from Prisma's `$metrics.json()` and re-published as `db_pool_active_connections` etc. via `wirePrismaPoolMetrics()`.

**Redis:** shared by two purposes — a 300s-TTL cache for balances/prices (via the `redis` npm client), and BullMQ's backing store (via a separate `ioredis` connection with `maxRetriesPerRequest: null`, as BullMQ requires).

**BullMQ:** `setupPortfolioJobs()` (called once at startup) enqueues a repeating job (`refresh-all-wallets`, `*/15 * * * *`). The worker iterates every `User` and calls the same `getPortfolioValue()` the API route uses — keeping data fresh even for inactive users.

## 3.4 Container Networking, Volume Mapping, and Service Communication

All 13 services share Compose's default bridge network and reach each other by **service name** (e.g. `db:5432`, not `localhost`) — why every internal `*_URL`/`*_HOST` variable points at a service name rather than an IP.

| Volume | Mounted In | Purpose |
|---|---|---|
| `pgdata` (named volume) | `db` → `/var/lib/postgresql/data` | Persists Postgres data across restarts |
| `./postgres-init` (bind mount) | `db` → `/docker-entrypoint-initdb.d` | Runs init scripts once |
| `./postgres-exporter-queries.yaml` (bind mount, ro) | `postgres-exporter` | Supplies the 5 custom SQL collectors |
| `./prometheus-config.yml`, `./alert.rules.yml` | `prometheus` | Scrape config and alert rules |
| `./alertmanager.yml` | `alertmanager` | SMTP/routing config |
| `./tempo-config.yaml` | `tempo` → `/etc/tempo.yaml` | OTLP receiver + local storage config |
| `./grafana-datasources.yml`, `./grafana-dashboards.yml`, dashboard JSONs | `grafana` | Datasource + dashboard provisioning, auto-loaded |

Only `3005` (frontend) and `3030` (backend API) are public; Grafana's `3000` is IP-restricted at the AWS security-group level; every other service is reachable only inside the Docker network or via SSH tunnel.

---
# 4. OBSERVABILITY STACK

## 4.1 Prometheus

**Definition:** An open-source, pull-based monitoring toolkit storing data as time series keyed by metric name plus labels.

**How it works:** Every `scrape_interval` (4s, aggressive — chosen for demo responsiveness, would be tuned to 15–30s at real production scale), Prometheus GETs `/metrics` on each target and stores each value as a timestamped sample. Independently, it evaluates every rule in `alert.rules.yml`; if an expression stays truthy past its `for:` duration, the alert fires and is pushed to Alertmanager.

```yaml
global:
  scrape_interval: 4s
alerting:
  alertmanagers:
    - static_configs:
        - targets: ["alertmanager:9093"]
rule_files:
  - "alert.rules.yml"
scrape_configs:
  - job_name: 'prometheus'
  - job_name: 'crypto-analytics'      # app:3030
  - job_name: 'node'                  # node-exporter:9100
  - job_name: 'postgres'              # postgres-exporter:9187
  - job_name: 'redis'                 # redis-exporter:9121
  - job_name: 'redis-client-monitor'  # redis-client-monitor:8001
```

**Docker image:** `prom/prometheus:latest`. **Port:** `9090` (internal only). **Advantages:** pull model needs no target-side discovery; PromQL suits the rate/percentile queries this dashboard suite relies on; native alerting. **Limitations:** local single-node storage only, no long-term retention/HA. **Access:** SSH tunnel or `localhost:9090` on the host, since 9090 isn't public.

## 4.2 Grafana

**Definition:** An analytics/visualization platform that queries external datasources and renders dashboards; it stores no data itself here.

**How it works:** On start, Grafana reads its provisioning directories and auto-configures 5 datasources and 2 dashboards with no manual UI work. Each panel embeds a query (PromQL, LogQL, TraceQL, raw SQL, or JSON-API) executed on a refresh interval.

| Datasource | Type | URL | Notes |
|---|---|---|---|
| Prometheus (default) | `prometheus` | `http://prometheus:9090` | Backs most panels |
| Loki | `loki` | `http://loki:3100` | Backs the LOGS panel |
| Tempo | `tempo` | `http://tempo:3200` | `tracesToLogsV2` → Loki for one-click correlation |
| Infinity | community plugin | `http://redis-client-monitor:8001` | Backs Redis per-client table/bar/pie panels |
| Postgres | `postgres` | `db:5432`, db `crypto_analytics`, user `monitoring_user` | Backs raw-SQL table panels |

**Docker image:** `grafana/grafana:latest` (`GF_INSTALL_PLUGINS=yesoreyeram-infinity-datasource` auto-installs the plugin). **Port:** `3000`, IP-restricted. **Advantages:** dashboards-as-JSON is version-controlled and reproducible; Infinity lets Grafana consume any JSON REST API. **Limitations:** the shared `monitoring_user` credential lives in datasource config — fine for a single operator, would need secrets management at team scale. **Access:** `http://13.206.106.64:3000`, IP-restricted, `admin`/`GRAFANA_ADMIN_PASSWORD` (kept in `.env` only). **Common issue:** Infinity requires its target host explicitly allow-listed or every query fails with "host not allowed" — a deliberate security control, not a bug.

---
![grafana loginn](screenshot/{B81B144C-E8DD-42CA-B2B1-1FA58655AA2C}.png)
---

## 4.3 Node Exporter

**Definition:** The official Prometheus exporter for host/OS metrics on *nix kernels — behind the entire Infrastructure Monitoring row with zero custom code.

**How it works:** Reads `/proc`/`/sys` directly and translates them into metrics (`node_cpu_seconds_total`, `node_memory_MemAvailable_bytes`, `node_filesystem_avail_bytes`, `node_network_receive_bytes_total`, `node_disk_reads_completed_total`, `node_load1`).

**Docker image:** `prom/node-exporter:latest`. **Port:** `9100`, no configuration needed. **Access:** internal only, scraped by Prometheus.

---
![Node Exporter](screenshot/{44AFE369-94DD-4CF0-BA34-9651CAD61AB6}.png)
---

## 4.4 Postgres Exporter

**Definition:** The community Postgres exporter, extended with custom SQL collectors.

**How it works:** Connects via the read-only `monitoring_user` role, then each scrape both queries Postgres's built-in statistics views (`pg_stat_database`, `pg_stat_activity`, `pg_stat_bgwriter`, `pg_locks`) and runs the 5 custom queries in `postgres-exporter-queries.yaml` (Section 11).

**Docker image:** `quay.io/prometheuscommunity/postgres-exporter:latest`. **Port:** `9187`.

| Variable | Value | Purpose |
|---|---|---|
| `DATA_SOURCE_NAME` | `postgresql://monitoring_user:<password>@db:5432/crypto_analytics?sslmode=disable` | Least-privilege connection |
| `PG_EXPORTER_EXTEND_QUERY_PATH` | `/etc/postgres-exporter/queries.yaml` | Points at the custom-queries file |

**A real issue encountered:** a custom query duplicated a built-in collector's metric name, breaking the exporter's entire `/metrics` endpoint (full detail in Section 15) — fixed by deleting the duplicate and relying on the built-in collector. **Access:** internal only, scraped at `postgres-exporter:9187`.

---
![Postgres Exporter](screenshot/{CB4EC839-CF61-4365-922E-B5F03BB7ABA8}.png)
![Postgres Exporter](screenshot/{63A5B7C6-E239-432C-9A38-7CDC846B5E30}.png)
---

## 4.5 Redis Exporter

**Definition:** The community (`oliver006/redis_exporter`) exporter for Redis.

**How it works:** Connects to `redis://redis:6379`, issues `INFO` on each scrape, and translates output into `redis_up`, `redis_memory_used_bytes`, `redis_connected_clients`, `redis_commands_processed_total`, `redis_keyspace_hits_total`/`_misses_total`, `redis_evicted_keys_total`.

**Docker image:** `oliver006/redis_exporter:latest`. **Port:** `9121`. Zero custom code needed for standard health; the hit-ratio calculation directly validates the 5-minute price/balance caching strategy. **Limitation:** no per-connection detail — the gap that motivated `redis-client-monitor` (Section 4.6). **Access:** internal only.

---
![ Redis Exporter](screenshot/{6BBA9792-64A4-47B3-9B46-B3749DAF73DB}.png)
---

## 4.6 Redis Client Monitor (Custom Exporter)

**Definition:** A bespoke Python/FastAPI microservice exposing per-connection Redis client detail — filling the gap `redis-exporter` leaves open (which clients are connected, from where, for how long) while keeping Prometheus's series count bounded.

**How it works:** A background asyncio poll loop (`poll_loop()`) calls `CLIENT LIST` every `POLL_INTERVAL_SECONDS` (default 5s) via `asyncio.to_thread`. Results go into a thread-safe `ClientStore`; on failure the poller backs off exponentially (`RECONNECT_BACKOFF_MIN`/`_MAX`) so a Redis restart doesn't spin it into a tight failure loop.

**Metrics at `/metrics`:**

| Metric | Type | Description |
|---|---|---|
| `redis_connected_clients_total` | Gauge | Current connected client count |
| `redis_client_connection_age_seconds` | Histogram | Distribution of connection ages |
| `redis_client_idle_seconds` | Histogram | Distribution of idle time |
| `redis_client_monitor_scrape_errors_total` | Counter | Failed `CLIENT LIST` polls |
| `redis_client_monitor_last_scrape_timestamp_seconds` | Gauge | Unix timestamp of last successful poll |
| `redis_client_monitor_up` | Gauge | 1 if last poll succeeded |

**Per-client detail (not in Prometheus, by design):** served via `GET /clients` (JSON array), consumed by Grafana's Infinity plugin rather than Prometheus, since per-client identity has unbounded cardinality (see "Cardinality Discipline" in Section 1.2).

**Docker image:** built from `./redis-client-monitor/Dockerfile` (`python:3.12-slim`), runs as non-root, has its own `HEALTHCHECK`. **Port:** `8001`. **Key env vars:** `REDIS_HOST`, `REDIS_PORT`, `REDIS_DB`, `REDIS_USERNAME`, `REDIS_PASSWORD`, `REDIS_TLS`, `REDIS_SOCKET_TIMEOUT`, `POLL_INTERVAL_SECONDS`, `RECONNECT_BACKOFF_MIN`/`_MAX`, `HTTP_HOST`, `HTTP_PORT`, `LOG_LEVEL`. **Access:** internal, but also depended on directly by Grafana since Infinity queries it live.

## 4.7 Loki

**Definition:** A horizontally scalable, label-based log aggregation system built by Grafana Labs, operated like Prometheus but for logs.

**How it works:** The backend's Winston logger uses a `winston-loki` transport (`src/logger.ts`) that pushes each log line over HTTP, tagged with the single static label `app: crypto-analytics-api`. Loki indexes only this label, not the body — the body (JSON, including `level`, `message`, `timestamp`, `traceId`, `spanId`) is stored and full-text/JSON-filterable at query time via LogQL.

**Docker image:** `grafana/loki:latest`. **Port:** `3100`. Much cheaper than full-text-indexed logging at this traffic scale; trivially correlated with Tempo via matching labels. **Limitation:** no long-term retention, single instance, no replication. **Access:** internal, queried by Grafana's Loki datasource.

---
![Grafana LOGS Panel (Error / Non-Error Log Streams)](screenshot/image.png)
Grafana LOGS Panel (Error / Non-Error Log Streams)
---

## 4.8 Tempo

**Definition:** Grafana Labs' distributed tracing backend, ingesting/storing traces in low-cost block formats (configured here with local disk storage).

**How it works:** `src/tracing.ts` configures an `OTLPTraceExporter` at `OTLP_TRACE_ENDPOINT` (`http://tempo:4318/v1/traces`) registered with a `NodeSDK` alongside auto-instrumentation for HTTP, Express, `pg`, `redis-4`, and Prisma. Tempo's `distributor` receives spans on its OTLP/HTTP receiver (port 4318) and writes to local block + WAL storage.

```yaml
server:
  http_listen_port: 3200
distributor:
  receivers:
    otlp:
      protocols:
        http:
          endpoint: 0.0.0.0:4318
storage:
  trace:
    backend: local
    local:
      path: /tmp/tempo/blocks
    wal:
      path: /tmp/tempo/wal
```

**Docker image:** `grafana/tempo:latest`. **Ports:** `3200` (query API) and `4318` (OTLP ingestion). Native OTLP means no vendor-specific SDK; local storage keeps things simple (trade-off: no long-term retention). **Access:** internal, queried by Grafana's Tempo datasource, cross-linked to Loki via `tracesToLogsV2`.

---
![Grafana Trace Explorer / Trace Detail View](screenshot/{74D338BE-BF19-4377-AFE3-2AF7604FD8EC}.png)
Grafana Trace Explorer / Trace Detail View
---

## 4.9 Alertmanager

**Definition:** Prometheus's component for deduplicating, grouping, and routing firing alerts.

**How it works:** Prometheus pushes firing/resolved alerts to Alertmanager's API. Alerts are grouped by `alertname`, wait `group_wait` (10s) before an initial notification, `group_interval` (30s) between updates, and never repeat the same alert more than once per `repeat_interval` (1h) — preventing inbox flooding.

```yaml
route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 30s
  repeat_interval: 1h
  receiver: 'email-alerts'
receivers:
  - name: 'email-alerts'
    email_configs:
      - to: '<redacted — see Section 16>'
        send_resolved: true
```

SMTP delivery uses Gmail's smarthost (`smtp.gmail.com:587`) with a Gmail **app password** and `smtp_require_tls: true`. `send_resolved: true` also emails when a condition clears.

**Docker image:** `prom/alertmanager:latest`. **Port:** `9093`. **Security note:** the Gmail app password is currently stored in plaintext in `alertmanager.yml`, which is committed to the repo — flagged as an open risk in Section 16.7/16.8. **Access:** internal; notifications arrive via email regardless of dashboard access.

---
*[Screenshot not available: `{578E43AE-F7C9-4E6F-B4E9-94BF7FB71AC5}.png` was referenced but is not present in the `screenshot/` folder — add it and re-run to include the Alertmanager alert list / email notification screenshot here.]*
---
# 5. COMPLETE OBSERVABILITY WORKFLOW

**5.1 How metrics are generated:** every metric originates from either `metricsMiddleware` (global, times every request via `process.hrtime()`, records `http_request_duration_seconds`/`http_requests_total`) or manual instrumentation calls in service functions (e.g. `loginAttemptsTotal.inc()`). All are registered on one shared `client.Registry()` in `src/metrics.ts`.

**5.2 How Prometheus scrapes:** every 4 seconds it GETs each target's `/metrics`. For the backend, `src/routes/metrics.ts` calls `register.metrics()` then **appends** Prisma's native `prisma.$metrics.prometheus()` output — one scrape captures both custom and Prisma metrics.

**5.3 How exporters work:** they translate native state into Prometheus format. `node-exporter` reads kernel interfaces; `postgres-exporter`/`redis-exporter` run status queries per scrape; the custom `redis-client-monitor` instead runs its own independent poll loop and serves the *last known* result, so a slow `CLIENT LIST` call never blocks a scrape.

**5.4 How Grafana queries Prometheus:** each panel embeds a PromQL expression; on load/refresh Grafana calls `/api/v1/query_range` (time series) or `/api/v1/query` (single value) and renders per the panel's visualization type.

**5.5 How logs travel to Loki:**

![How Logs Travel to Loki](diagrams/diagram4_logs_to_loki.png)

Every log line is JSON, timestamped, and automatically enriched with the active trace's `traceId`/`spanId` (via a custom Winston format reading `trace.getSpan(context.active())`) — enabling jumps from a slow trace to the exact log lines.

**5.6 How traces reach Tempo:**

![How Traces Reach Tempo](diagrams/diagram5_traces_to_tempo.png)

`src/tracing.ts` loads via Node's `-r` flag **before** application code, required for OpenTelemetry auto-instrumentation to patch modules before they're first imported.

**5.7 How Alertmanager receives alerts:** Prometheus continuously evaluates `alert.rules.yml` against live data; once an expression stays non-empty past its `for:` duration (30s for two rules, 10s for `InvalidEndpointHit`), it fires and is pushed to `alertmanager:9093`.

**5.8 How Gmail SMTP sends alerts:** the `email-alerts` receiver connects to `smtp.gmail.com:587` via STARTTLS with a Gmail app password. On firing and later resolution, it emails the alert name, severity, and the `summary`/`description` annotations.

**5.9 How dashboards are updated:** dashboards are **not** hand-edited in the UI — they're JSON files committed to the repo, mounted into Grafana, and re-read on every container start. A dashboard change deploys the same way as a code change: edit, commit, push, `git pull`, redeploy.

---
# 6. DEPLOYMENT ARCHITECTURE

## 6.1 Docker and Docker Compose

The platform is one `docker-compose.yml` with 13 services (app ×2, data stores ×2, observability ×5, exporters ×4), giving declarative orchestration, inter-service DNS, health-check-gated startup ordering, volumes, and ports from one file and one command.

## 6.2 Container Inventory

| Service | Container Name | Image / Build | Host:Container Ports | Depends On |
|---|---|---|---|---|
| `app` | `crypto-app` | build: `./Dockerfile` (`node:20-alpine`) | 3030:3030 | `db` (healthy), `redis` |
| `frontend` | `crypto-frontend` | build: `./frontend/Dockerfile` (`node:20-alpine`) | 3005:3005 | `app` |
| `db` | `crypto-pg` | `postgres:15-alpine` | 5432:5432 | — |
| `postgres-exporter` | `crypto-postgres-exporter` | `quay.io/prometheuscommunity/postgres-exporter:latest` | 9187:9187 | `db` (healthy) |
| `redis` | `crypto-redis` | `redis:7-alpine` | 6379:6379 | — |
| `redis-exporter` | `crypto-redis-exporter` | `oliver006/redis_exporter:latest` | 9121:9121 | `redis` |
| `redis-client-monitor` | `crypto-redis-client-monitor` | build: `./redis-client-monitor` (`python:3.12-slim`) | 8001:8001 | `redis` |
| `prometheus` | `crypto-prometheus` | `prom/prometheus:latest` | 9090:9090 | — |
| `alertmanager` | `crypto-alertmanager` | `prom/alertmanager:latest` | 9093:9093 | — |
| `loki` | `crypto-loki` | `grafana/loki:latest` | 3100:3100 | — |
| `tempo` | `crypto-tempo` | `grafana/tempo:latest` | 3200:3200, 4318:4318 | — |
| `node-exporter` | `crypto-node-exporter` | `prom/node-exporter:latest` | 9100:9100 | — |
| `grafana` | `crypto-grafana` | `grafana/grafana:latest` (+ Infinity plugin) | 3000:3000 | `redis-client-monitor` |

## 6.3 Backend Dockerfile — Multi-Stage Build

```dockerfile
FROM node:20-alpine AS deps       # install dependencies only
FROM node:20-alpine AS builder    # generate Prisma client, compile TypeScript
FROM node:20-alpine AS runner     # copy only compiled output + node_modules + prisma
CMD sh -c "npx prisma migrate deploy && npm start"
```

The three-stage build keeps the runtime image lean (no compiler, no dev deps) while still running `prisma generate`/`tsc` at build time. `prisma migrate deploy` runs automatically on container start, so a new migration in a PR applies with no separate manual step.

## 6.4 Environment Variables

### 6.4.1 Backend runtime (`.env`, read by `src/`)

| Variable | Consumed In | Purpose |
|---|---|---|
| `PORT` | `index.ts` | HTTP listen port (3030) |
| `DATABASE_URL` | `index.ts`, Prisma | Postgres connection string |
| `REDIS_URL` | `db.ts`, `portfolioQueue.ts`, `portfolioWorker.ts` | Redis connection string |
| `JWT_SECRET` | `auth.ts`, `authService.ts` | JWT signing/verification secret |
| `OTLP_TRACE_ENDPOINT` | `tracing.ts` | Tempo OTLP HTTP endpoint |
| `LOKI_HOST` | `logger.ts` | Loki push endpoint |
| `COINGECKO_API_URL` | `priceService.ts` | CoinGecko base URL |
| `ETHERSCAN_API_KEY` | `portfolioService.ts` | Etherscan API key |

### 6.4.2 Docker Compose interpolation (`.env`, consumed only by `docker-compose.yml`)

| Variable | Purpose |
|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Postgres superuser + database name |
| `MONITORING_PASSWORD` | Password for the read-only `monitoring_user` role |
| `GRAFANA_ADMIN_PASSWORD` | Grafana `admin` account password |
| `NEXT_PUBLIC_API_BASE_URL` | Baked into the frontend image at build time |

## 6.5 Production Deployment — AWS EC2 Architecture

![Production Deployment — AWS EC2 Architecture](diagrams/diagram6_aws_deployment.png)

- **Instance:** `i-008919cbd197c873a`, `t3.small`, `ap-south-1`.
- **Elastic IP:** `13.206.106.64` — fixed, survives stop/start/reboot.
- **Security group:** `sg-052850be668b8c437` — SSH (22) and Grafana (3000) locked to the operator's IP; API (3030) and frontend (3005) public; every other service has no inbound rule at all.
- **Deployment credentials:** a scoped IAM user (`ai-agent-user`, EC2+ECR only) — not root (see Section 16 for the outstanding root-key item).
- **Storage:** a single 30GB `gp3` EBS volume backing the instance, including `pgdata`.

## 6.6 Deployment / Redeployment Process

![Deployment / Redeployment Process](diagrams/diagram7_redeploy.png)

There is **no CI/CD pipeline** — every deployment is a manual SSH session running `git pull` then `docker compose up -d --build`, which rebuilds only changed images and restarts only those containers. Migrations apply automatically via the `app` container's startup command.

## 6.7 Operational Notes — Instance Stop/Start

`restart: unless-stopped` only survives a Docker daemon restart, not a full EC2 stop/start — containers can come back `Exited (0)`, leaving `crypto-app` crash-looping (`P1001: Can't reach database server`). Recovery: re-run `docker compose up -d` after instance start (safe to re-run), let `depends_on: condition: service_healthy` do its job, and confirm `crypto-pg` shows `healthy` via `docker compose ps -a` before assuming the app is reachable.

## 6.8 Cost Profile

| Item | Approx. Cost | Notes |
|---|---|---|
| EC2 `t3.small` | ~$15/month | Billed only while running |
| 30GB `gp3` EBS volume | ~$3/month | Billed regardless of instance state |
| Elastic IP | Free | While attached to a running instance |

---
# 7. DASHBOARD DOCUMENTATION

The platform ships two provisioned Grafana dashboards: **"Crypto Analytics Platform – Control Center"** (23 panels, 6 rows) and **"Redis Connected Clients"** (5 panels). Both auto-load from JSON — no manual construction needed.

## 7.1 Dashboard: Crypto Analytics Platform – Control Center

**Purpose:** one operational dashboard covering infrastructure, application, database, and cache health, letting anyone answer "is the system healthy right now, and if not, where's the problem?" in under a minute. **Datasources:** Prometheus (most panels), Loki (LOGS), Postgres (raw SQL tables).

### 7.1.1 Row: Infrastructure Monitoring

| Panel | Metric / Query | Business Value |
|---|---|---|
| CPU Usage | `100 - (avg by(instance)(rate(node_cpu_seconds_total{mode="idle"}[5m]))*100)` | Detects host-level CPU saturation |
| Memory Usage | `100 * (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes))` | Detects memory pressure before OOM |
| Disk Usage % | `100 * (1 - node_filesystem_avail_bytes / node_filesystem_size_bytes)` | Prevents the EBS volume filling up |
| System Uptime | `node_time_seconds - node_boot_time_seconds` | Confirms no unexpected reboot |
| Network Rx/Tx Throughput | `rate(node_network_receive/transmit_bytes_total{device!="lo"}[5m])` | Surfaces traffic anomalies |
| Disk Read/Write IOPS | `rate(node_disk_reads/writes_completed_total{device="sdd"}[5m])` | Correlates disk I/O with DB slowdowns |
| System Load Average | `node_load1` | Composite host contention indicator |

---
![CPU, Memory, Disk %, Uptime, Network](screenshot/{C82D87F4-E79C-4356-8BAC-B9666D5AEBB6}.png)
Grafana Infrastructure Monitoring Row (CPU, Memory, Disk %, Uptime, Network)
---

### 7.1.2 Row: Business & Analytics Metrics

| Panel | Metric / Query | Business Value |
|---|---|---|
| HTTP Request Rate | `rate(http_requests_total[1m])` | Overall traffic trend |
| Login Failures Rate | `rate(login_failures_total[1m])` | Brute-force detection |
| AI Analytics Engine Latency | `rate(ai_analysis_latency_seconds_sum[5m]) / rate(ai_analysis_latency_seconds_count[5m])` | Cost of generating insights |
| External API Latency | `rate(external_api_latency_sum[5m]) / rate(external_api_latency_count[5m])` | Isolates third-party slowness |
| LOGS (split error / non-error) | LogQL error/non-error streams | Live log stream beside the summary metrics |

---
![Grafana Business & Analytics Metrics Row ](screenshot/{38DB4758-6DE8-4833-A51B-4B7FEB5A18A6}.png)
Grafana Business & Analytics Metrics Row (HTTP Request Rate, Login Failures, AI Latency, External API Latency)
---
![Grafana LOGS Panel](screenshot/{7EBD94C1-DD78-4C19-8B31-A0F44198C0B2}.png)
Grafana LOGS Panel — Error / Non-Error Log Streams
---

### 7.1.3 Row: Backend Service Monitoring

| Panel | Metric / Query | Business Value |
|---|---|---|
| HTTP Requests per Second | `sum(rate(http_requests_total[5m]))` | Aggregate throughput |
| Active HTTP Requests | `sum(http_requests_in_flight)` | Surfaces hanging requests |
| Average Request Duration | `rate(http_request_duration_seconds_sum[5m]) / rate(http_request_duration_seconds_count[5m])` | Coarse latency trend |
| HTTP Error Rate | `(sum(rate(http_requests_total{code=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))) * 100` | Server-side failure % |
| P50/P90/P95/P99 Response Time | `histogram_quantile(0.50/0.90/0.95/0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))` | Full latency distribution |
| HTTP Status Code Distribution | `sum by(code)(rate(http_requests_total[5m]))` | 2xx/3xx/4xx/5xx breakdown |
| Endpoint Latency | `histogram_quantile(0.95, sum by(le,route)(rate(http_request_duration_seconds_bucket[5m])))` | Per-route P95 latency |
| Endpoint Throughput | `sum by(route)(rate(http_requests_total[5m]))` | Per-route traffic |

---
![Grafana Backend Service Monitoring Row](screenshot/{64193089-B7A4-424C-ACEE-E0B6974812A0}.png)
Grafana Backend Service Monitoring Row (Requests/sec, Active Requests, Avg Duration, Error Rate)
---
![P50/P90/P95/P99 Response Time](screenshot/{4D71AC54-430B-4EEF-AC2C-320553D41FF2}.png)
Grafana Backend Service Monitoring Row — P50/P90/P95/P99 Response Time
---
![HTTP Status Code Distribution and Endpoint Latency](screenshot/{FEB2E614-8F34-4BAB-8148-C534B0EB3D15}.png)
Grafana Backend Service Monitoring Row — HTTP Status Code Distribution and Endpoint Latency
---
![Endpoint Throughput](screenshot/{C6296D11-0AEA-4BAE-B5DE-5462D687D49C}.png)
Grafana Backend Service Monitoring Row — Endpoint Throughput
---

### 7.1.4 Row: Database Monitoring

| Panel | Metric / Query | Business Value |
|---|---|---|
| Database Query Throughput | `rate(db_query_duration_count[5m])` | Query volume trend |
| Average Query Latency | `(rate(db_query_duration_sum[5m]) / rate(db_query_duration_count[5m])) * 1000` (ms) | Coarse DB latency trend |
| P95 Query Latency | `histogram_quantile(0.95, sum(rate(db_query_duration_bucket[5m])) by (le))` | Tail-latency visibility |
| Database Health Score | Composite boolean-sum expression (Section 9.5) | Single 0–5 score combining risk conditions |
| "database queries duration count" | `rate(db_query_duration_count[5m])` (Success/Failed) | Confirms query volume is flowing |
| Connection Pool Utilization | `(db_pool_active_connections / db_pool_max_connections) * 100` | Warns before pool exhaustion |
| Slowest Queries (call-site) | `topk(10, histogram_quantile(0.95, sum by(query,le)(rate(db_query_duration_bucket[5m]))))` | Ranks call sites by P95 latency |

> **Observed state note:** in the reference screenshots, *Database Health Score* shows "No data" and *Connection Pool Utilization* shows 0% — expected during a low-traffic idle period, since the underlying gauges need an active sample to populate. See Section 15.

### 7.1.5 Row: Database Performance

| Panel | Metric / Query | Business Value |
|---|---|---|
| P50/P90 Query Latency | `histogram_quantile(0.50/0.90, sum(rate(db_query_duration_bucket[5m])) by (le)) * 1000` | Full latency distribution in ms |
| Read Distribution (Cache Efficiency) | `pg_stat_database_blks_hit` vs `blks_read` rates | Postgres cache-hit ratio |
| Wait Event Distribution | `sum by(wait_event_type)(pg_stat_activity_count{wait_event_type!=""})` | Shows *why* backends are waiting |
| Write Distribution | `pg_stat_database_tup_inserted/updated/deleted` rates | Insert/update/delete breakdown |
| Disk IO | `node_disk_read/write_bytes_total` + latency-per-op | Correlates DB slowness with disk throughput |
| Deadlock Analysis | `increase(pg_stat_database_deadlocks{datname="crypto_analytics"}[5m])` | Data-integrity risk events |
| Connection Pool / Blocking / Running / Long-Running (>2s) Queries | `db_pool_*`; `pg_blocking_sessions_duration_seconds`; `pg_running_queries_duration_seconds` | Live "what is Postgres doing right now" |
| Top 10 Slowest Queries (`pg_stat_statements`) | `topk(10, pg_stat_statements_mean_exec_time_ms)` | Deepest-level DB observability |

---
![P50/P90 Latency, Read Distribution, Wait Events, Write Distribution, Disk IO](screenshot/{81A823EE-EAAA-473B-AAF2-9CBD03A1D8DB}.png)
Grafana Database Performance Row (P50/P90 Latency, Read Distribution, Wait Events, Write Distribution, Disk IO)
---
![Top 10 Slowest Queries (pg_stat_statements)](screenshot/{DB9BA55C-369D-475F-A9D4-2DF632A2A233}.png)
Grafana Database Performance Row — Top 10 Slowest Queries (pg_stat_statements)
---

### 7.1.6 Row: Redis Cache & Queue Monitoring

| Panel | Metric / Query | Business Value |
|---|---|---|
| Redis Up | `redis_up` | Basic liveness |
| Redis Memory Used | `redis_memory_used_bytes` | Tracks memory growth |
| Redis Connected Clients | `redis_connected_clients` | Aggregate connection count |
| Redis Ops/sec | `rate(redis_commands_processed_total[1m])` | Command throughput |
| Redis Cache Hit Ratio | `100 * hits/(hits+misses)` (5m rate) | Validates the 5-minute TTL strategy |
| Redis Evicted Keys Rate | `rate(redis_evicted_keys_total[5m])` | Memory pressure signal |

> **Observed state note:** a ~79% cache hit ratio in the reference screenshots is consistent with the app's 300-second caching design, climbing toward 100% under sustained repeated reads.

## 7.2 Dashboard: Redis Connected Clients

**Purpose:** a deep-dive companion answering *which* clients are connected, down to IP/username, for connection-leak investigations. **Datasources:** Prometheus (aggregate count, timeline), Infinity/JSON-API (per-client detail).

| Panel | Datasource | Description |
|---|---|---|
| Total Connected Clients | Prometheus (`redis_connected_clients_total`) | Headline aggregate count |
| Connected Clients (table) | Infinity → `redis-client-monitor:8001/clients` | Per-client: ID, IP, username, age, idle time |
| Clients by IP (bar chart) | Infinity | Flags one IP opening many connections |
| Clients by Username (pie chart) | Infinity | Breaks down by authenticated identity |
| Connection Timeline | Prometheus | Historical trend of connected-client count |

---
![ Redis Dashboard](screenshot/{6BBA9792-64A4-47B3-9B46-B3749DAF73DB}.png)
Grafana Redis Connected Clients Dashboard — Full View
---
# 8. VISUALIZATION TYPES

| Visualization | Purpose | Data Source | Reason for Choosing |
|---|---|---|---|
| Time Series | Trend of a metric over time | Prometheus | Most legible way to show rate/latency history |
| Gauge | Current value vs. min/max, color thresholds | Prometheus | Communicates "how close to the limit" at a glance |
| Stat (big number) | A single headline value | Prometheus | Maximizes visual weight for one key number |
| Pie Chart | Proportional breakdown | Prometheus / Infinity | Proportions read more intuitively than a table |
| Bar Chart / Bar Gauge | Compare discrete categories | Prometheus / Infinity | Easy magnitude comparison |
| Table | Raw structured rows | Postgres / Infinity | Some data is inherently row-oriented |
| Logs panel | Stream matching log lines | Loki | Purpose-built LogQL viewer with in-panel filtering |
| "No data" / composite Stat | Derived composite indicator | Prometheus (composite expression) | Collapses several conditions into one go/no-go signal |

---
# 9. COMPLETE PROMQL DOCUMENTATION

## 9.1 Alert Rule Queries

| PromQL Query | Panel | Description | Threshold | Optimization Notes |
|---|---|---|---|---|
| `sum by (route) (rate(http_requests_total[1m])) > 0.5` | `HighRequestRate` alert | Per-route request rate over 1 min | Fires if > 0.5 req/s for 30s | 1-min window is noisy at low traffic; would widen to 5m at scale |
| `increase(http_requests_total{code="404"}[1m]) > 2` | `InvalidEndpointHit` alert | Count of 404s in the last minute | Fires if > 2 in 1 min for 10s | Short `for:` intentionally fires fast on probing bursts |
| `sum by(route)(rate(http_request_duration_seconds_sum[1m])) / sum by(route)(rate(...count[1m])) > 0.5` | `SlowEndpointLatency` alert | Average per-route latency over 1 min | Fires if avg > 0.5s for 30s | An average can hide tail latency — P95/P99 panels compensate |

## 9.2 Infrastructure Panel Queries

| PromQL Query | Panel | Threshold (color) |
|---|---|---|
| `100 - (avg by(instance)(rate(node_cpu_seconds_total{mode="idle"}[5m]))*100)` | CPU Usage | Green < 70%, amber 70–90%, red > 90% |
| `100 * (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes))` | Memory Usage | Green < 70%, amber 70–90%, red > 90% |
| `100 * (1 - node_filesystem_avail_bytes{...} / node_filesystem_size_bytes{...})` | Disk Usage % | Green < 70%, amber 70–85%, red > 85% |
| `node_time_seconds - node_boot_time_seconds` | System Uptime | Informational |
| `rate(node_network_receive/transmit_bytes_total{device!="lo"}[5m])` | Network Rx/Tx Throughput | Informational, watch for spikes |
| `rate(node_disk_reads/writes_completed_total{device="sdd"}[5m])` | Disk Read/Write IOPS | Informational |
| `node_load1` | System Load Average | Amber approaching vCPU count, red above it |

## 9.3 Business / Application Metric Queries

| PromQL Query | Panel | Expected Value |
|---|---|---|
| `rate(http_requests_total[1m])` | HTTP Request Rate | Proportional to active users |
| `rate(login_failures_total[1m])` | Login Failures Rate | Near 0 under normal use |
| `rate(ai_analysis_latency_seconds_sum[5m]) / rate(...count[5m])` | AI Analytics Engine Latency | Sub-second for the deterministic analyzer |
| `rate(external_api_latency_sum[5m]) / rate(...count[5m])` | External API Latency | 100–300ms typical |

## 9.4 Backend Service Monitoring Queries

| PromQL Query | Panel | Purpose |
|---|---|---|
| `sum(rate(http_requests_total[5m]))` | HTTP Requests per Second | Overall load |
| `sum(http_requests_in_flight)` | Active HTTP Requests | Detect hung requests accumulating |
| `rate(http_request_duration_seconds_sum[5m]) / rate(...count[5m])` | Average Request Duration | Coarse performance trend |
| `(sum(rate(http_requests_total{code=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))) * 100` | HTTP Error Rate | Core reliability KPI |
| `histogram_quantile(0.50/0.90/0.95/0.99, sum(rate(...bucket[5m])) by (le))` | P50/P90/P95/P99 Response Time | Full latency distribution |
| `sum by(code)(rate(http_requests_total[5m]))` | HTTP Status Code Distribution | Traffic-quality breakdown |
| `histogram_quantile(0.95, sum by(le,route)(rate(...bucket[5m])))` | Endpoint Latency | Pinpoints which route is slow |
| `sum by(route)(rate(http_requests_total[5m]))` | Endpoint Throughput | Traffic distribution across routes |

*Note: `http_requests_in_flight` appears in the dashboard's PromQL but is not yet defined in `src/metrics.ts` — see Section 15.5 (the panel shows "No data" until it's added).*

## 9.5 Database Monitoring & Performance Queries

| PromQL Query | Panel | Purpose |
|---|---|---|
| `rate(db_query_duration_count[5m])` | Database Query Throughput | Confirms DB traffic is flowing |
| `(rate(db_query_duration_sum[5m]) / rate(db_query_duration_count[5m])) * 1000` | Average Query Latency (ms) | Coarse DB performance trend |
| `histogram_quantile(0.95, sum(rate(db_query_duration_bucket[5m])) by (le))` | P95 Query Latency | Surfaces slow-query impact |
| `histogram_quantile(0.50/0.90, ...) * 1000` | P50/P90 Query Latency | Latency distribution in ms |
| **Database Health Score** (composite, 5 boolean conditions summed — long-running query > 30s, P95 > 500ms, any deadlock in 1h, any lock wait, pool > 90%) | Database Health Score | 0 = healthy; higher = more risk conditions present |
| `rate(portfolio_refresh_failures_total[5m])` | Cross-cutting | Detects silent BullMQ worker failures |
| `(db_pool_active_connections / db_pool_max_connections) * 100` | Connection Pool Utilization | Warns before pool exhaustion |
| `topk(10, histogram_quantile(0.95, sum by(query,le)(rate(...bucket[5m]))))` | Slowest Queries (call-site) | Ranks by instrumented code location |
| `pg_stat_database_blks_hit` vs `blks_read` | Read Distribution (Cache Efficiency) | Validates Postgres's own caching |
| `sum by(wait_event_type)(pg_stat_activity_count{...})` | Wait Event Distribution | Diagnoses *why* sessions are blocked |
| `pg_stat_database_tup_inserted/updated/deleted` | Write Distribution | Write-workload composition |
| `pg_stat_bgwriter_buffers_checkpoint_total` rate | Disk IO (checkpoint activity) | Postgres write-behind activity |
| `node_disk_read/write_bytes_total` rate | Disk IO | Correlates with DB read/write pressure |
| `node_disk_read_time_seconds_total` / `reads_completed_total` | Disk IO (latency per op) | Detects a slow underlying EBS volume |
| `pg_stat_database_temp_bytes` rate | Disk IO / Database Performance | Flags queries spilling to disk |
| `pg_wal_wal_bytes` rate | Database Performance (WAL) | Write-ahead-log volume for backup sizing |
| `increase(pg_stat_database_deadlocks{...}[5m])` | Deadlock Analysis | Data-integrity-risk contention |
| `db_pool_active_connections` / `_idle_connections` / `_waiting_clients` / `_max_connections` | Connection Pool | Live pool state |
| `pg_blocking_sessions_duration_seconds` | Blocking Sessions | Live lock-contention detail |
| `pg_running_queries_duration_seconds` (raw, `> 2` filtered) | Running / Long Running Queries | Live "what is Postgres doing right now" |
| `topk(10, pg_stat_statements_mean_exec_time_ms)` | Top 10 Slowest Queries | Deepest-level DB optimization target list |

## 9.6 Redis Panel Queries

| PromQL Query | Panel | Purpose |
|---|---|---|
| `redis_up` | Redis Up | Cache/queue backend availability |
| `redis_memory_used_bytes` | Redis Memory Used | Capacity tracking |
| `redis_connected_clients` | Redis Connected Clients | Aggregate connection health |
| `rate(redis_commands_processed_total[1m])` | Redis Ops/sec | Load trend |
| `100 * rate(redis_keyspace_hits_total[5m]) / (hits+misses rate)` | Redis Cache Hit Ratio | Validates the 300s TTL strategy |
| `rate(redis_evicted_keys_total[5m])` | Redis Evicted Keys Rate | Memory pressure signal |
| `redis_connected_clients_total` (custom exporter) | Redis Connected Clients dashboard | Cross-check against `redis_exporter`'s count |

## 9.7 Loki (LogQL) Queries

| Query | Panel | Description |
|---|---|---|
| `{service_name="crypto-analytics-api"} \| level = "error"` | LOGS (error stream) | All error-level log lines |
| Same query, `level != "error"` | LOGS (non-error stream) | All non-error log lines, viewed side-by-side |

---
# 10. CUSTOM METRICS DOCUMENTATION

All custom metrics are registered in `src/metrics.ts` against one `client.Registry()`, with `prefix: 'crypto_analytics_'` applied to Node.js default metrics via `client.collectDefaultMetrics()`.

## 10.1 Backend Application Metrics

| Metric | Type | Labels | Purpose | Representative Query |
|---|---|---|---|---|
| `http_request_duration_seconds` | Histogram (0.1–10s) | `method`, `route`, `code` | Request latency distribution | `histogram_quantile(0.95, sum(rate(...bucket[5m])) by (le))` |
| `http_requests_total` | Counter | `method`, `route`, `code` | Request volume + status | `rate(http_requests_total[1m])` |
| `login_attempts_total` | Counter | — | Auth funnel volume | `login_attempts_total` |
| `login_failures_total` | Counter | — | Brute-force detection | `rate(login_failures_total[1m])` |
| `wallet_lookup_total` | Counter | — | Feature usage tracking | `wallet_lookup_total` |
| `portfolio_requests_total` | Counter | — | Core feature usage | `portfolio_requests_total` |
| `portfolio_refresh_total` | Counter | — | Background job execution volume | `portfolio_refresh_total` |
| `portfolio_refresh_failures_total` | Counter | — | Silent-failure detection for the worker | `rate(portfolio_refresh_failures_total[5m])` |
| `ai_analysis_requests_total` | Counter | — | Feature usage | `ai_analysis_requests_total` |
| `ai_analysis_latency_seconds` | Summary | — | Feature cost/performance | `rate(ai_analysis_latency_seconds_sum[5m])/rate(...count[5m])` |
| `cache_hits_total` / `cache_misses_total` | Counter | — | Cache effectiveness | `cache_hits_total` / `cache_misses_total` |
| `external_api_latency` | Histogram (0.1–5s) | — | Third-party dependency latency | `rate(external_api_latency_sum[5m])/rate(...count[5m])` |
| `db_query_duration` | Histogram (0.01–2s) | `query` (fixed call-site name) | DB call-site latency | `topk(10, histogram_quantile(0.95, sum by(query,le)(rate(...bucket[5m]))))` |
| `db_pool_active_connections` / `_idle_connections` / `_waiting_clients` | Gauge | — | Live Prisma pool usage | `db_pool_active_connections` |
| `db_pool_max_connections` | Gauge | — | Configured pool ceiling | `(db_pool_active_connections/db_pool_max_connections)*100` |

**Why `db_query_duration` uses a fixed `query` label, not raw SQL:** the label comes only from a small set of call-site string literals, never generated SQL — keeping cardinality bounded regardless of how many distinct queries the app grows to run (see "Cardinality Discipline" in Section 1.2).

**Why pool gauges are sampled, not polled from a raw `pg.Pool`:** this app uses Prisma exclusively (`src/db.ts`), so there's no raw pool to introspect. Prisma's `prisma.$metrics.json()` (a preview feature) is sampled every 5s and re-published under this project's own gauge names.

## 10.2 Node.js Default Metrics (via `prom-client`)

`client.collectDefaultMetrics({ register, prefix: 'crypto_analytics_' })` registers standard runtime metrics — event loop lag, heap size/usage, active handles, GC duration, CPU seconds — since process-level health is a leading indicator of application latency degradation.

## 10.3 Prisma Native Metrics (Appended, Not Re-Wrapped)

`src/routes/metrics.ts` appends `prisma.$metrics.prometheus()`'s raw output onto the `/metrics` response, including Prisma's own pool gauges and query-duration histograms, kept in their native pre-aggregated bucket format rather than re-observed (which would lose precision).

## 10.4 Redis Client Monitor Metrics (Python)

See Section 4.6 for the full table of `redis_connected_clients_total`, `redis_client_connection_age_seconds`, `redis_client_idle_seconds`, `redis_client_monitor_scrape_errors_total`, `redis_client_monitor_last_scrape_timestamp_seconds`, and `redis_client_monitor_up`.

## 10.5 Third-Party Exporter Metrics (Consumed, Not Authored)

| Source | Representative Metrics |
|---|---|
| `node-exporter` | `node_cpu_seconds_total`, `node_memory_*`, `node_filesystem_*`, `node_network_*`, `node_disk_*`, `node_load1` |
| `postgres-exporter` (built-in) | `pg_stat_database_*`, `pg_stat_activity_count`, `pg_stat_bgwriter_*`, `pg_locks_waiting_total` (custom, Section 11) |
| `redis-exporter` | `redis_up`, `redis_memory_used_bytes`, `redis_connected_clients`, `redis_commands_processed_total`, `redis_keyspace_hits_total`/`_misses_total`, `redis_evicted_keys_total` |

---
# 11. POSTGRES CUSTOM EXPORTER QUERIES

`postgres-exporter-queries.yaml` defines 5 custom SQL collectors, loaded via `PG_EXPORTER_EXTEND_QUERY_PATH`. Each top-level key becomes a metric-name prefix. Every query is deliberately cardinality-bounded — capped with `LIMIT`, filtered to non-idle sessions, and query text is normalized/truncated.

## 11.1 `pg_stat_statements`

Provides per-query-shape execution statistics — the richest DB performance source in the platform. Selects normalized/truncated (200 char) query text, `calls`, execution time, rows, buffer/temp-block stats, and WAL bytes, limited to the top 50 by total execution time. `pg_stat_statements` already parameterizes literal values at the Postgres level, plus this query normalizes whitespace and truncates — so no literal user data becomes a label value. Scraped every 4s via `monitoring_user`. **Dashboard:** "Top 10 Slowest Queries" — `topk(10, pg_stat_statements_mean_exec_time_ms)`.

## 11.2 `pg_locks_waiting`

A count of currently-blocked lock requests, feeding the Database Health Score composite. **SQL:** `SELECT count(*) FROM pg_locks WHERE NOT granted`. **Metric:** `pg_locks_waiting_total` (Gauge).

## 11.3 `pg_blocking_sessions`

Surfaces actual blocked/blocking PID pairs, not just a count — needed to diagnose which session is stuck behind which. Joins `pg_stat_activity` against itself via `pg_blocking_pids()`, including normalized/truncated (150 char) query text and wait duration. **Dashboard:** "Blocking Sessions" panel, raw SQL table.

## 11.4 `pg_running_queries`

One query intentionally backs two panels — "Running Queries" (unfiltered) and "Long Running Queries (>2s)" (filtered in PromQL) — avoiding duplicate SQL. Selects all non-idle `pg_stat_activity` rows, excluding the exporter's own PID. **Metric:** `pg_running_queries_duration_seconds` (Gauge). Also feeds the Health Score.

## 11.5 `pg_wal`

Tracks WAL generation for write-load and backup/replication sizing. **SQL:** `SELECT wal_records, wal_bytes, wal_buffers_full FROM pg_stat_wal`. **Metrics:** `pg_wal_wal_records_total`, `pg_wal_wal_bytes_total`, `pg_wal_wal_buffers_full_total` (Counters). **Dashboard:** WAL Throughput — `rate(pg_wal_wal_bytes[5m])`.

## 11.6 Deliberately Not Custom-Queried: Wait Events and Backend State Counts

Not defined as custom queries because `postgres_exporter` already ships a built-in `pg_stat_activity_count` collector covering this exact data. A custom query of the same shape was tried during development and caused a **metric-name collision**, breaking the exporter's entire `/metrics` endpoint. Fixed by removing the duplicate and pointing both the "Wait Event Distribution" and "Database Health Score" panels at the built-in collector. Full incident in Section 15.

## 11.7 Postgres Initialization Scripts

| Script | Purpose |
|---|---|
| `postgres-init/01-pg-stat-statements.sql` | `CREATE EXTENSION IF NOT EXISTS pg_stat_statements;` — the shared library must additionally be preloaded via `shared_preload_libraries`, since the extension can't be fully enabled through `CREATE EXTENSION` alone |
| `postgres-init/02-monitoring-role.sh` | Creates `monitoring_user`, grants `pg_monitor` plus explicit `SELECT` on `pg_stat_statements`. Named `monitoring_user` (not `pg_monitor_user`) since `pg_`-prefixed role names are reserved |

---
# 12. API DOCUMENTATION

Production base URL: `http://13.206.106.64:3030` (health checks unprefixed; business endpoints under `/api`; metrics at root `/metrics`). All request bodies are Zod-validated; authenticated routes log an `AuditLog` entry via `logAudit()`.

## 12.1 Auth Endpoints — `/api/auth` (public)

### POST `/api/auth/register`
- **Auth:** None. **Request:** `{ "email": "...", "password": "at-least-8-characters" }`. **Validation:** valid email, min length 8.
- **Response (201):** `{ "id": "uuid", "email": "..." }`. **Errors:** `409` if email already registered (Prisma `P2002`).
- **Side effects:** password hashed with bcrypt (cost 10); writes `AuditLog` (`USER_REGISTERED`).

### POST `/api/auth/login`
- **Auth:** None, rate-limited (5/min/IP via `loginLimiter`). **Request:** `{ "email": "...", "password": "..." }`.
- **Response (200):** `{ "token": "eyJhbGci..." }`. **Errors:** `401` invalid credentials; `429` rate limit exceeded.
- **Side effects:** increments `login_attempts_total`; on failure increments `login_failures_total` + `SecurityEvent` (`LOGIN_FAILED`); on success `AuditLog` (`USER_LOGGED_IN`); JWT signed with `JWT_SECRET`, 1h expiry, `{ id, email }`.

## 12.2 Wallet Endpoints — `/api/wallets` (JWT required)

### POST `/api/wallets`
- **Request:** `{ "address": "0x1234...abcd", "network": "ethereum" }`. **Validation:** Zod plus `ethers.isAddress()` for Ethereum addresses.
- **Response (201):** the created `Wallet` record. **Side effects:** `AuditLog` (`WALLET_ADDED`); on failure `SecurityEvent` (`WALLET_ADD_FAILED`).

### GET `/api/wallets`
- **Response (200):** array of `Wallet` records. **Side effects:** increments `wallet_lookup_total`.

### DELETE `/api/wallets/:id`
- **Response:** `204`. **Side effects:** `AuditLog` (`WALLET_REMOVED`); deletion scoped to `{ id, userId }`.

## 12.3 Portfolio Endpoints — `/api/portfolio` (JWT required)

### GET `/api/portfolio`
- **Purpose:** total portfolio value (USD) across all wallets. **Response:** `{ "totalValueUSD": ..., "wallets": [...] }`.
- **Side effects:** increments `portfolio_requests_total`; `AuditLog` (`PORTFOLIO_VIEWED`); fetches balances (cached 300s), token balances via Etherscan, prices via CoinGecko (cached 300s), writes a new `PortfolioSnapshot` per wallet on every read.
- **Traced spans:** `getPortfolioValue`, `fetch_eth_balance`, `fetch_token_balances`, `fetch_prices`.

### GET `/api/portfolio/history/:walletId`
- Ownership-checked (`403` otherwise). **Response:** array of `{ id, walletId, valueUsd, createdAt }`, ascending.

### GET `/api/portfolio/performance/:walletId`
- Ownership-checked. **Response:** `{ percentageChange, absoluteChange, currentValue, previousValue }` (zeros if fewer than 2 snapshots exist).

### GET `/api/portfolio/insights/:walletId`
- Ownership-checked. **Response:** `{ risk, diversificationScore, concentrationRisk, stablecoinExposure, assetAllocation, insights }`.
- **Side effects:** increments `ai_analysis_requests_total`; timed as `ai_analysis_latency_seconds`; manual span `generate_portfolio_insights`.
- Resolved via a `tsyringe` DI container bound to `DeterministicAnalyzer` (rule-based); an `LLMAnalyzer` stub exists for future use (Section 18).

## 12.4 Health Endpoints — unprefixed (public)

| Method | Path | Description | Response |
|---|---|---|---|
| GET | `/health` | Basic liveness check | `200 { "status": "UP" }` |
| GET | `/live` | Liveness probe | `200 { "status": "UP" }` |
| GET | `/ready` | Pings Postgres + Redis | `200`/`503` |

## 12.5 Metrics Endpoint — `/metrics` (public, scraped by Prometheus)

| Method | Path | Description |
|---|---|---|
| GET | `/metrics` | Full `prom-client` registry + appended Prisma `$metrics.prometheus()` output |

## 12.6 Redis Client Monitor Endpoints — `redis-client-monitor:8001` (internal only)

| Method | Path | Description |
|---|---|---|
| GET | `/metrics` | Aggregate, label-free Redis client metrics |
| GET | `/clients` | Per-client JSON detail, consumed by Grafana's Infinity datasource |
| GET | `/health` | `{ "status": "ok", "clients_tracked": N, "last_updated": <ts> }` |

---
# 13. DATABASE DESIGN

## 13.1 Entity-Relationship Diagram

![Entity-Relationship Diagram](diagrams/diagram8_er.png)

*(`SecurityEvent` has no foreign key to `User` — it intentionally captures events, like failed logins with an unknown email, that may not map to any existing user.)*

## 13.2 Model-by-Model Explanation

**`User`:** a registered account — `id` (UUID PK), `email` (unique), `password` (bcrypt hash), timestamps. One-to-many with `Wallet` and `AuditLog`.

**`Wallet`:** a tracked blockchain address — `id`, `address`, `network`, `userId`, timestamps. `@@unique([address, network])` prevents the same address/network pair being registered twice system-wide. Many-to-one with `User`; one-to-many with `PortfolioSnapshot`.

**`PortfolioSnapshot`:** a time-series record of a wallet's USD value — `id`, `walletId`, `valueUsd`, `createdAt`. `onDelete: Cascade` (added in the `cascade_delete_snapshots` migration) avoids orphaned rows when a wallet is deleted. A new row is inserted on every `getPortfolioValue()` call, from both live requests and the 15-minute background refresh.

**`AuditLog`:** a durable trail of user-initiated actions — `id`, `userId` (nullable), `action`, `details` (JSON), `ip`, `createdAt`. Written by `logAudit()` on every register, login, wallet mutation, and portfolio view.

**`SecurityEvent`:** a lighter trail for security *anomalies* — currently `LOGIN_FAILED` and `WALLET_ADD_FAILED`. Written by `logSecurityEvent()`, which also always emits a `logger.warn()`, so every event is visible in both the database and the Loki log stream.

## 13.3 Migration History

| Migration | Timestamp | Change |
|---|---|---|
| `crypto` (initial) | 2026-06-11 04:28:20 | Initial schema: `User`, `Wallet`, `AuditLog` |
| `add_portfolio_snapshot` | 2026-06-11 06:41:50 | Added `PortfolioSnapshot` and its relation to `Wallet` |
| `cascade_delete_snapshots` | 2026-06-11 17:30:23 | Changed `Wallet → PortfolioSnapshot` to `onDelete: Cascade` |

## 13.4 Prisma Configuration Notes

`schema.prisma` enables two preview features: `tracing` (lets `@prisma/instrumentation` auto-generate OpenTelemetry spans per query) and `metrics` (exposes `prisma.$metrics.json()`/`.prometheus()`, which this project's pool gauges and appended `/metrics` output both depend on).

---
# 14. CONFIGURATION FILES

| File | Purpose | Key Details |
|---|---|---|
| `docker-compose.yml` | Defines and wires all 13 services | Ports, volumes, env vars, health checks — Section 6.2 |
| `Dockerfile` | Backend 3-stage build | `deps` → `builder` → `runner`; runs `prisma migrate deploy` on start — Section 6.3 |
| `frontend/Dockerfile` | Frontend 3-stage build | Bakes `NEXT_PUBLIC_API_BASE_URL` at build time — Section 6.5 |
| `redis-client-monitor/Dockerfile` | Python sidecar image | `python:3.12-slim`, non-root, own `HEALTHCHECK` |
| `.env` / `.env.example` | Runtime configuration | Backend + compose interpolation vars — Section 6.4; `.env` never committed |
| `prometheus-config.yml` | Prometheus scrape configuration | 4s interval, 6 jobs — Section 4.1 |
| `alert.rules.yml` | Prometheus alert rules | 3 rules — Section 9.1 |
| `alertmanager.yml` | Alertmanager routing + SMTP | Gmail SMTP, 1h repeat interval — Section 4.9, Section 16 |
| `grafana-datasources.yml` | Datasource provisioning | 5 datasources — Section 4.2 |
| `grafana-dashboards.yml` | Dashboard-file-provider config | Auto-loads from `/var/lib/grafana/dashboards` |
| `grafana-dashboard.json` | "Control Center" dashboard | 23 panels, 6 rows — Section 7.1 |
| `redis-clients-dashboard.json` | Redis client-detail dashboard | 5 panels — Section 7.2 |
| `tempo-config.yaml` | Tempo config | OTLP receiver on `:4318` — Section 4.8 |
| `postgres-exporter-queries.yaml` | Custom Postgres collectors | 5 collectors — Section 11 |
| `postgres-init/*.sql`, `*.sh` | DB init scripts | Enable `pg_stat_statements`; create `monitoring_user` |
| `prisma/schema.prisma` | Data model + config | 5 models, `tracing`+`metrics` preview features — Section 13 |
| `redis-client-monitor/app/config.py` | Sidecar settings | Env-driven `Settings` dataclass — Section 4.6 |
| `jest.config.js` | Test runner config | Configures `ts-jest` |
| `tsconfig.json` (root + frontend) | TypeScript config | Separate backend/frontend configs |
| `.dockerignore` (×3) | Build-context exclusions | Keeps `node_modules`, `.git`, `.env` out of builds |

---
# 15. TROUBLESHOOTING

## 15.1 postgres_exporter `/metrics` Endpoint Fails Entirely

| Field | Detail |
|---|---|
| **Problem** | The exporter's `/metrics` endpoint stopped responding — every Postgres metric disappeared at once |
| **Actual root cause** | A custom query duplicated a metric-name shape from the exporter's own built-in `pg_stat_activity_count` collector, causing a duplicate registration |
| **Resolution** | Removed the duplicate custom query; both affected panels point at the built-in collector instead |
| **Prevention** | Check the exporter's built-in collector list before adding any custom query — now documented in Section 11.6 |

## 15.2 `pg_stat_statements` Not Available After a Fresh Deploy

| Field | Detail |
|---|---|
| **Problem** | Top-slowest-query panels show no data on a fresh Postgres volume |
| **Actual cause** | `pg_stat_statements` requires `shared_preload_libraries` at server start — `CREATE EXTENSION` alone isn't enough |
| **Resolution** | `docker-compose.yml`'s `db` service passes the preload flags directly on the Postgres command line |
| **Prevention** | Verify an extension's activation requirements before assuming `CREATE EXTENSION` suffices |

## 15.3 `crypto-app` Crash-Looping After an EC2 Instance Restart

| Field | Detail |
|---|---|
| **Problem** | `crypto-app` repeatedly crashes after stopping/restarting the EC2 instance |
| **Log example** | `Error: P1001: Can't reach database server at db:5432` |
| **Actual cause** | `restart: unless-stopped` doesn't survive a full instance stop/start; `db`/`redis` can come back `Exited (0)` |
| **Resolution** | After instance start, run `docker compose up -d`, wait ~10s, confirm `crypto-pg` is `(healthy)` before assuming the app is up |
| **Prevention** | `depends_on: condition: service_healthy` handles this correctly during a coordinated `docker compose up` |

## 15.4 Grafana Infinity Datasource Queries Fail

| Field | Detail |
|---|---|
| **Problem** | Redis Connected Clients panels return an error instead of data |
| **Actual cause (common)** | The Infinity plugin enforces an `allowedHosts` allow-list independent of the target's actual health |
| **Resolution** | Confirm the URL matches `allowedHosts` (`http://redis-client-monitor:8001`); separately confirm `GET /health` |
| **Prevention** | Treat "host not allowed" as a config check first, not a health check first |

## 15.5 "No Data" on `http_requests_in_flight`-Based Panels

| Field | Detail |
|---|---|
| **Problem** | "Active HTTP Requests" panel shows "No data" |
| **Actual cause** | `http_requests_in_flight` is referenced in the dashboard but not yet defined in `src/metrics.ts` |
| **Resolution / status** | Tracked as a Section 18 item — add a `Gauge` incremented/decremented around each request |
| **Prevention** | Cross-check any new dashboard panel against `src/metrics.ts` before shipping |

## 15.6 Database Health Score / Connection Pool Panels Show "No Data" or 0% During Idle Periods

| Field | Detail |
|---|---|
| **Problem** | During idle periods, Health Score shows "No data" and Pool Utilization shows 0% |
| **Actual cause** | Expected: the pool gauge only populates on an active 5s sample, and the composite score needs several series present simultaneously |
| **Resolution** | No fix needed — documented in Section 7.1.4 |
| **Prevention** | Generate light synthetic traffic before demoing these panels |

## 15.7 Frontend Points at the Wrong API Host After an IP/Domain Change

| Field | Detail |
|---|---|
| **Problem** | Frontend keeps calling the old backend address after an IP/domain change |
| **Actual cause** | `NEXT_PUBLIC_API_BASE_URL` is baked in at Docker **build** time, not read at runtime |
| **Resolution** | Update `.env`, then rebuild (not just restart): `docker compose up -d --build frontend` |
| **Prevention** | Documented in `PRODUCTION.md` as a Next.js build-time-inlining gotcha |

---
# 16. SECURITY IMPLEMENTATION

## 16.1 Authentication — JWT

Stateless: `jsonwebtoken` signs `{ id, email }`, HS256, 1-hour expiry. `authenticateToken` verifies the `Bearer` token on every protected route; missing → `401`, invalid/expired → `403`. Both outcomes are logged with IP and path.

## 16.2 Password Hashing — bcrypt

Passwords are never stored or logged in plaintext. `bcrypt.hash(password, 10)` at registration, `bcrypt.compare()` at login — adaptive cost and built-in salting make offline brute-force expensive.

## 16.3 Rate Limiting — `express-rate-limit`

| Limiter | Scope | Limit | Purpose |
|---|---|---|---|
| `apiLimiter` | All `/api/*` | 100 req / 15 min / IP | General abuse/DoS mitigation |
| `loginLimiter` | `/api/auth/login` | 5 req / min / IP | Brute-force mitigation |

Both log a warning with the offending IP, giving a queryable audit trail in Loki.

## 16.4 HTTP Hardening — Helmet & CORS

`helmet()` applies a battery of security headers globally with framework defaults. `cors()` allows the frontend (different port) to call the API, using permissive defaults appropriate for this single-known-frontend topology.

## 16.5 Input Validation — Zod

Every mutating endpoint validates its body against a Zod schema before business logic runs; Ethereum addresses are additionally validated via `ethers.isAddress()`.

## 16.6 Monitoring & Infrastructure Security

Only `3005`/`3030` are open to the internet; Grafana is IP-restricted; every other service has no inbound rule at all. The monitoring path uses a dedicated, least-privilege `monitoring_user` role (read-only) rather than the app's own credentials. Custom exporter queries normalize/truncate query text so no literal parameter values leak into labels. Grafana's admin password lives only in the server's `.env`, with network-level IP restriction as defense in depth. Deployment uses a scoped IAM user (`ai-agent-user`), not root credentials.

## 16.7 SMTP / Alerting Security — Known Risk

Alertmanager's Gmail app password is currently stored **in plaintext in `alertmanager.yml`**, which is committed to the repo — a genuine, outstanding risk flagged here deliberately.

> **Recommendation:** rotate the Gmail app password immediately and move it into a Docker secret or env-var substitution so it's never in version control history going forward.

## 16.8 Outstanding Security Items (as of this report)

| Item | Risk | Status |
|---|---|---|
| Gmail app password committed in plaintext | Credential exposure via repo access/history | Open — rotate and externalize (16.7) |
| AWS root account access key still active | Broadest possible blast radius if leaked | Open — deactivate; deployment already uses scoped IAM |
| No automated Postgres backup strategy | Data loss risk — `pgdata` lives on one EBS volume | Open — see Section 18 |
| No CI pipeline (manual deploy) | Human-error risk during deployment | Open — see Section 18 |

Documenting these openly, with concrete remediation direction, is itself part of good security practice for this report.

---
# 17. LESSONS LEARNED

**Technical skills:** designing a Prometheus metrics taxonomy across HTTP, business-logic, database, and cache layers with the correct metric type for each; implementing OpenTelemetry auto-instrumentation alongside manual spans, and why the tracing bootstrap must load before application code; correlating logs and traces via injected span context; reading Postgres's internal statistics views for real query-level analysis; avoiding unbounded label cardinality via two concrete design decisions rather than just reading about the anti-pattern.

**DevOps skills:** writing multi-stage Dockerfiles that stay lean while still running build-time steps; orchestrating a 13-service Compose stack with health-check-gated ordering; diagnosing and resolving a real production incident (the exporter metric-collision outage); operating a manual deployment workflow safely and repeatably.

**Cloud skills:** provisioning and securing a single EC2 instance under least-exposure principles; using an Elastic IP to decouple the public address from instance lifecycle; scoping deployment credentials to a dedicated IAM user and documenting the outstanding root-key risk rather than ignoring it.

**Monitoring skills:** building composite health-score panels from multiple PromQL conditions; designing dashboards around rows of related concern rather than an unstructured grid; choosing the right visualization per data shape; configuring alert grouping/repeat intervals to avoid both fatigue and missed notifications.

**Professional skills:** producing runbook documentation written for someone else under time pressure; making and explaining deliberate trade-off decisions (keeping per-client Redis identity out of Prometheus) to a technical reviewer; surfacing and tracking security findings rather than quietly working around them.

---
# 18. FUTURE IMPROVEMENTS

| Area | Improvement | Rationale |
|---|---|---|
| Alerting/Security | Rotate and externalize the Gmail SMTP app password | Currently plaintext — highest-priority open item (16.7) |
| Cloud Security | Deactivate the AWS root account's access key | Deployment already uses a scoped IAM user |
| Reliability | Add automated PostgreSQL backups (`pg_dump` to S3 or EBS snapshots) | `pgdata` exists only on one instance's EBS volume, no backup |
| CI/CD | Introduce a CI pipeline (build, test, optionally auto-deploy) | Deployment is currently fully manual SSH + `git pull` |
| Metrics completeness | Define and instrument `http_requests_in_flight` | Referenced by a panel but not currently emitted (15.5) |
| AI Feature | Complete `LLMAnalyzer` (OpenAI/Groq) via the existing DI container | Interface and wiring already exist; only the LLM call is a stub |
| Observability retention | Add long-term/remote-write storage for Prometheus and object storage for Tempo/Loki | Local-disk storage means history is lost if a volume is recreated |
| Scalability | Evaluate a move to multi-node/managed orchestration (ECS/Kubernetes) if traffic grows | Current architecture optimizes for cost/simplicity, not horizontal scale |
| Frontend observability | Expand frontend OpenTelemetry instrumentation for full browser-to-database tracing | Backend tracing is comprehensive; frontend stitching is the natural next step |
| Testing | Expand automated test coverage beyond the current AI-analyzer unit tests | `src/__tests__/ai.test.ts` is currently the only test file |

---
# 19. APPENDIX

## 19.1 Useful Docker Commands

```bash
sudo docker compose up -d --build          # bring the stack up (build if needed)
sudo docker compose up -d --build app      # rebuild/restart a single service
sudo docker compose ps -a                  # status of all containers
sudo docker logs crypto-app --tail 50      # tail logs for a service
sudo docker logs crypto-frontend --tail 50
sudo docker compose down                   # stop without removing volumes

aws ec2 stop-instances --instance-ids i-008919cbd197c873a --profile deploy --region ap-south-1
aws ec2 start-instances --instance-ids i-008919cbd197c873a --profile deploy --region ap-south-1
```

## 19.2 Useful Prometheus Commands / Endpoints

```bash
curl localhost:9090/api/v1/targets      # scrape target health
curl localhost:9090/api/v1/rules        # alert rule evaluation state
curl localhost:9090/metrics             # Prometheus's own metrics

ssh -i ~/.ssh/crypto-analytics-key.pem -L 9090:localhost:9090 ec2-user@13.206.106.64
# then open http://localhost:9090 locally
```

## 19.3 Useful Grafana Commands / Access

```bash
http://13.206.106.64:3000
# Login: admin / <GRAFANA_ADMIN_PASSWORD from .env — rotate before sharing this report>
```

## 19.4 Troubleshooting Commands

```bash
sudo docker compose ps -a | grep crypto-pg
curl http://localhost:3030/ready
curl http://localhost:8001/health
curl http://localhost:3030/metrics | less
```

## 19.5 Useful URLs (Production)

| Service | URL | Access |
|---|---|---|
| Frontend | `http://13.206.106.64:3005` | Public |
| Backend API | `http://13.206.106.64:3030` | Public (`/api/*`, `/health`, `/metrics`) |
| Grafana | `http://13.206.106.64:3000` | IP-restricted |
| Prometheus, Alertmanager, Loki, Tempo, exporters | internal Docker network only | SSH tunnel required |

## 19.6 References

- Prometheus documentation — https://prometheus.io/docs/
- Grafana documentation — https://grafana.com/docs/
- Grafana Loki documentation — https://grafana.com/docs/loki/
- Grafana Tempo documentation — https://grafana.com/docs/tempo/
- OpenTelemetry JavaScript documentation — https://opentelemetry.io/docs/languages/js/
- PostgreSQL `pg_stat_statements` documentation — https://www.postgresql.org/docs/current/pgstatstatements.html
- Prisma metrics preview feature documentation — https://www.prisma.io/docs/orm/prisma-client/observability-and-logging/metrics
- BullMQ documentation — https://docs.bullmq.io/
- Project internal references: `PRODUCTION.md`, `PROJECT_ARCHITECTURE.md`, `DATABASE_OBSERVABILITY.md`, `EXECUTION_GUIDE.md`, `project_analysis.md`
