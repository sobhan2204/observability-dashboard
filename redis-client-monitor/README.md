# Redis Client Monitor

A lightweight FastAPI service that polls `CLIENT LIST` on a Redis instance
every few seconds and exposes the result two ways:

- `GET /metrics` — aggregate, label-free Prometheus metrics (safe cardinality).
- `GET /clients` — full per-client detail as JSON, for Grafana's Infinity
  (JSON API) datasource to render as a table/bar/pie.
- `GET /health` — liveness/readiness probe.

Per-client fields (id, name, user, ip, port, db, age, idle, flags, resp,
last_command) are deliberately **not** turned into Prometheus labels — IPs
and client IDs are unbounded/high-cardinality and would blow up Prometheus'
series count as connections churn. They're served as JSON instead.

## Why redis-py instead of shelling out to `redis-cli`

The brief mentions `redis-cli CLIENT LIST`, but this service calls Redis'
`CLIENT LIST` command directly through `redis-py` (`client.client_list()`)
over the existing connection pool. Functionally identical, but it avoids a
subprocess per poll, avoids shell-quoting/injection surface entirely, and
redis-py already parses the `key=value` wire format for us.

## Configuration (environment variables)

| Variable | Default | Description |
|---|---|---|
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_DB` | `0` | Redis logical DB |
| `REDIS_USERNAME` | _(unset)_ | ACL username, if auth is enabled |
| `REDIS_PASSWORD` | _(unset)_ | Password / ACL password |
| `REDIS_TLS` | `false` | Set `true` if Redis requires TLS |
| `REDIS_SOCKET_TIMEOUT` | `3` | Socket/connect timeout (seconds) |
| `POLL_INTERVAL_SECONDS` | `5` | How often to run CLIENT LIST |
| `RECONNECT_BACKOFF_MIN` | `1` | Initial reconnect backoff (seconds) |
| `RECONNECT_BACKOFF_MAX` | `30` | Max reconnect backoff (seconds) |
| `HTTP_HOST` | `0.0.0.0` | Bind address |
| `HTTP_PORT` | `8001` | Bind port |
| `LOG_LEVEL` | `INFO` | Python logging level |

## Running locally

```bash
cd redis-client-monitor
pip install -r requirements.txt
REDIS_HOST=localhost uvicorn app.main:app --host 0.0.0.0 --port 8001
```

## Running via Docker Compose

The service is already wired into the repo's root `docker-compose.yml` as
`redis-client-monitor`, alongside `redis`, `prometheus`, and `grafana`:

```bash
docker compose up -d --build
```

This will:

1. Build and start `redis-client-monitor` on port `8001`, pointed at the
   `redis` service.
2. Add a Prometheus scrape job (`redis-client-monitor:8001`) — see
   `prometheus-config.yml`.
3. Provision an Infinity (JSON API) Grafana datasource pointed at
   `http://redis-client-monitor:8001` — see `grafana-datasources.yml`. Grafana
   installs the `yesoreyeram-infinity-datasource` plugin automatically via
   `GF_INSTALL_PLUGINS`.
4. Provision the `Redis Connected Clients` dashboard
   (`redis-clients-dashboard.json`) automatically — Grafana's dashboard
   provider watches `/var/lib/grafana/dashboards`.

If your Redis instance requires auth, set `REDIS_USERNAME`/`REDIS_PASSWORD`
(or edit the `redis-client-monitor` service's `environment:` block in
`docker-compose.yml`) — and pass the same `--requirepass`/ACL config to the
`redis` service itself.

## Dashboard panels

Open Grafana (`http://localhost:3000`, default admin/admin) → **Redis
Connected Clients**:

1. **Total Connected Clients** — stat panel from `redis_connected_clients_total`.
2. **Connected Clients** — table of every active connection (Client ID,
   Name, Username, IP, Port, DB, Age, Idle, Last Command), refreshed every 5s.
3. **Clients by IP** — bar chart, grouped/counted from `/clients`.
4. **Clients by Username** — pie chart, grouped/counted from `/clients`.
5. **Connection Timeline** — time series of `redis_connected_clients_total`.

## Metrics exposed on `/metrics`

- `redis_connected_clients_total` (gauge) — current client count.
- `redis_client_connection_age_seconds` (histogram) — snapshot distribution
  of connection ages, sampled each poll.
- `redis_client_idle_seconds` (histogram) — snapshot distribution of idle
  times, sampled each poll.
- `redis_client_monitor_up` (gauge) — 1 if the last poll succeeded, 0 if not.
- `redis_client_monitor_last_scrape_timestamp_seconds` (gauge).
- `redis_client_monitor_scrape_errors_total` (counter).

## Production notes

- **Reconnection**: on any failure the connection is dropped and the poller
  retries with exponential backoff (`RECONNECT_BACKOFF_MIN` →
  `RECONNECT_BACKOFF_MAX`), so a Redis restart doesn't wedge the service.
- **Resource usage**: single async event loop, one blocking Redis call per
  poll interval offloaded via `asyncio.to_thread` — no thread/process pool
  growth, minimal idle CPU.
- **Logging**: structured, leveled logs to stdout; poll failures log with
  attempt count and backoff delay.
- **Container**: runs as a non-root user, has a `HEALTHCHECK` against
  `/health`.
- **Extending**: add new derived fields in `app/redis_client.py::parse_client_entry`,
  new aggregate metrics in `app/metrics.py`, or new panels against `/clients`
  — no changes to the polling/reconnection logic needed.
