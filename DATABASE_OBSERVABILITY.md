# PostgreSQL Observability

How database performance is instrumented and monitored end-to-end, and what
question each metric/panel answers. Covers the "Database Performance" section
of `grafana-dashboard.json`, `postgres-exporter-queries.yaml`,
`postgres-init/*.sql`, and the Prisma pool metrics in `src/metrics.ts`.

## Architecture

Three collection paths feed one Prometheus instance:

1. **App-level (Node.js / `prom-client`, `src/metrics.ts`)** — things only the
   application knows: which call site issued a query (`db_query_duration`,
   labeled by a fixed call-site name, never raw SQL), and Prisma's own
   connection-pool state (`db_pool_*`, via `prisma.$metrics`).
2. **Database-internals (`postgres_exporter`)** — everything PostgreSQL
   itself tracks: `pg_stat_statements`, lock waits, blocking sessions, wait
   events, deadlocks, checkpoint/WAL/bgwriter activity. This runs as its own
   container (`postgres-exporter` in `docker-compose.yml`) using a dedicated
   least-privilege `monitoring_user` role (`postgres-init/02-monitoring-role.sql`)
   rather than polling these from inside the Node app - it keeps working even
   if the app process is down, and doesn't couple app uptime to DB-internals
   visibility.
3. **Infra-level (`node_exporter`)** — host CPU/memory/disk, already present
   before this work.

`postgres-exporter-queries.yaml` intentionally does **not** duplicate metrics
postgres_exporter already exposes by default (`pg_stat_database`,
`pg_stat_bgwriter`, `pg_stat_activity_count` with per-state and per-wait-event
labels, `pg_wal`) - a custom query with the same name as a built-in one
crashes the exporter's `/metrics` endpoint entirely (Prometheus client
libraries reject two metrics with the same name but different HELP text).
This was hit and fixed during development; see the comment at the top of
that file.

Query text is never exposed as a raw label with literal values: PostgreSQL's
own `pg_stat_statements` already replaces literals with `$1`, `$2`, etc., and
every custom query additionally whitespace-normalizes and truncates the text
(150-200 chars) before it becomes a Prometheus label, to bound label size and
avoid needlessly wide series.

## Setup requirements

- **`pg_stat_statements`** must be loaded via `shared_preload_libraries` at
  Postgres startup (it cannot be enabled with `CREATE EXTENSION` alone) -
  see the `command:` block on the `db` service in `docker-compose.yml`.
- **`postgres-init/*.sql`** only runs automatically the *first* time a
  Postgres data volume is initialized. If you already have data in the
  `pgdata` volume (as was the case here), run both scripts manually once:
  `docker compose exec -T db psql -U admin -d crypto_analytics -f - < postgres-init/01-pg-stat-statements.sql`
  (and the same for `02-monitoring-role.sql`).
- **Prisma metrics** require the `metrics` preview feature
  (`prisma/schema.prisma`) and a regenerated client: `npx prisma generate`.
- **`DATABASE_URL`** should set `connection_limit` explicitly (added to
  `.env`) - otherwise Prisma defaults to `num_physical_cpus * 2 + 1`, which
  makes the "pool max" dashboard numbers depend on whatever machine happens
  to run the app.

## Metrics reference

### Query performance (`pg_stat_statements`, via postgres_exporter)

| Metric | What it is | Answers |
|---|---|---|
| `pg_stat_statements_calls` | Execution count per normalized query shape | Is this query getting hotter? |
| `pg_stat_statements_mean_exec_time_ms` | Mean execution time per call | Which query is slow on average? (Top 10 Slowest Queries) |
| `pg_stat_statements_total_exec_time_ms` | Cumulative execution time (calls x mean) | Which query costs the most *overall* database time, even if individually fast? (Top Query Consumers) |
| `pg_stat_statements_rows` | Total rows returned/affected | Is a query returning more data than expected? |
| `pg_stat_statements_shared_blks_hit` / `_shared_blks_read` | Buffer cache hits vs disk reads, per query | Which query is responsible for cache misses? |
| `pg_stat_statements_temp_blks_written` / `_temp_blks_read` | Temp file blocks | Is this query spilling sorts/hashes to disk (`work_mem` too small)? |
| `pg_stat_statements_wal_bytes` | WAL generated per query shape | Which query is driving replication/WAL volume? |

App-level equivalents already existed (`db_query_duration_*`, from
`dbQueryDuration.startTimer()` in `walletService.ts`/`authService.ts`) but
only see queries the app explicitly wrapped. `pg_stat_statements` sees every
statement Postgres executes, from any source - the two are complementary,
not redundant, which is why both are kept.

### Wait events & blocking (`pg_stat_activity`, `pg_blocking_pids()`)

| Metric | What it is | Answers |
|---|---|---|
| `pg_stat_activity_count{wait_event_type, wait_event, state, ...}` | Backend counts by state/wait, built into postgres_exporter | Why is the database slow *right now*? (Wait Event Distribution panel: mostly Lock = contention, mostly IO = disk-bound, mostly Client = app/network-bound) |
| `pg_locks_waiting_total` | Count of lock requests not yet granted | Is anything blocked at all, right now? |
| `pg_blocking_sessions_duration_seconds{blocked_pid, blocking_pid, blocked_query, blocking_query, ...}` | Each blocked session paired with its blocker, via `pg_blocking_pids()` | Who is blocking whom, with what query, for how long? (Blocking Sessions table) |

### Long-running & active queries (`pg_running_queries`, custom query)

`pg_running_queries_duration_seconds{pid, database, user, application, state, query}`
is one metric backing two panels: "Running Queries" (unfiltered - everything
active right now) and "Long Running Queries" (the same metric with a
PromQL `> 30` filter for the 30s threshold), so there's one query to
maintain instead of two near-duplicates.

### Deadlocks

`pg_stat_database_deadlocks{datname}` (postgres_exporter built-in). Any
sustained non-zero `increase()` means the application has a lock-ordering
bug, not just a tuning problem - unlike lock *waits* (contention, resolves
itself), a deadlock is PostgreSQL forcibly killing one transaction.

### Cache efficiency & write volume (`pg_stat_database`, built-in)

`blks_hit` / `blks_read` (Read Distribution - cache hit ratio, should be
>99% for OLTP), `tup_inserted` / `tup_updated` / `tup_deleted` (Write
Distribution), `temp_bytes` (queries spilling to disk).

### Checkpoints & WAL (`pg_stat_bgwriter` built-in, `pg_wal` custom query)

`pg_stat_bgwriter_checkpoints_req_total` rising relative to
`checkpoints_timed_total` means `checkpoint_timeout`/`max_wal_size` are too
small for the write rate. `pg_stat_bgwriter_buffers_backend_total` rising
means backends are writing buffers themselves because bgwriter/checkpointer
can't keep up - write pressure. `pg_wal_wal_bytes`/`pg_wal_wal_records` (own
query against `pg_stat_wal`, PG14+) show WAL throughput directly.

### Connection pool (Prisma, `src/metrics.ts`)

| Metric | Source | Answers |
|---|---|---|
| `db_pool_active_connections` / `db_pool_idle_connections` | `prisma.$metrics.json()` gauges, polled every 5s by `wirePrismaPoolMetrics()` | How much of the pool is in use right now? |
| `db_pool_waiting_clients` | Same | Are queries queued behind the pool limit? (the direct cause of latency that query-duration metrics alone won't show) |
| `db_pool_max_connections` | Parsed from `DATABASE_URL`'s `connection_limit` at startup | What's the ceiling? |

The Prisma client's own native Prometheus text (`prisma.$metrics.prometheus()`,
appended in `src/routes/metrics.ts`) additionally exposes
`prisma_client_queries_wait_histogram_ms` - the pool acquisition-time
histogram - under Prisma's own metric names, since converting its
pre-aggregated histogram buckets into `prom-client` `.observe()` calls would
lose data.

**Why not raw `pg.Pool`:** the app uses Prisma exclusively (`src/db.ts`) - there
is no `pg.Pool` instance anywhere to poll. The previous `wirePoolMetrics()` /
`wireLockMetrics()` functions took a `pg.Pool` argument that nothing in the
codebase could ever supply, so they were dead code; they've been replaced
with `wirePrismaPoolMetrics()`, and lock/deadlock polling moved to
postgres_exporter (point 2 above).

## Database Health Score (`panel-79`, improved)

Five boolean signals summed 0-5 (0=Healthy, 1-2=Warning, 3+=Critical): P95
latency > 500ms, any query running > 30s, any deadlock in the last hour, any
lock wait right now, pool utilization > 90%. Uses `> bool` comparisons (not
plain filters) so a signal that's simply absent (e.g. zero long-running
queries) contributes 0 to the sum instead of dropping the whole expression.

## Grafana Postgres datasource

A direct `postgres` datasource (`grafana-datasources.yml`, using the same
read-only `monitoring_user` role) is provisioned alongside Prometheus. No
dashboard panel queries it - all Database Performance panels use Prometheus,
to keep one query language and one credential set across the whole
dashboard. It exists for ad hoc investigation in Grafana Explore (e.g.
hand-written SQL against `pg_stat_statements` or `pg_locks` during an
incident, beyond what a fixed dashboard panel shows).
