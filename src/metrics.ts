import client from 'prom-client';
import { Pool } from 'pg';

// Create a Registry
const register = new client.Registry();

// Add default metrics (e.g. CPU, memory)
client.collectDefaultMetrics({ register, prefix: 'crypto_analytics_' });

export const httpRequestDurationMicroseconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in microseconds',
  labelNames: ['method', 'route', 'code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

export const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'code']
});

export const loginAttemptsTotal = new client.Counter({
  name: 'login_attempts_total',
  help: 'Total number of login attempts'
});

export const loginFailuresTotal = new client.Counter({
  name: 'login_failures_total',
  help: 'Total number of login failures'
});

export const walletLookupTotal = new client.Counter({
  name: 'wallet_lookup_total',
  help: 'Total number of wallet lookups'
});

export const portfolioRequestsTotal = new client.Counter({
  name: 'portfolio_requests_total',
  help: 'Total number of portfolio value requests'
});

export const portfolioRefreshTotal = new client.Counter({
  name: 'portfolio_refresh_total',
  help: 'Total number of background portfolio refreshes'
});

export const portfolioRefreshFailuresTotal = new client.Counter({
  name: 'portfolio_refresh_failures_total',
  help: 'Total number of failed portfolio refreshes'
});

export const aiAnalysisRequestsTotal = new client.Counter({
  name: 'ai_analysis_requests_total',
  help: 'Total number of AI analysis requests'
});

export const aiAnalysisLatency = new client.Summary({
  name: 'ai_analysis_latency_seconds',
  help: 'Latency of AI analysis requests in seconds'
});


export const cacheHitsTotal = new client.Counter({
  name: 'cache_hits_total',
  help: 'Total cache hits'
});

export const cacheMissesTotal = new client.Counter({
  name: 'cache_misses_total',
  help: 'Total cache misses'
});

export const externalApiLatency = new client.Histogram({
  name: 'external_api_latency',
  help: 'Latency of external API calls (CoinGecko)',
  buckets: [0.1, 0.3, 0.5, 1, 2, 5]
});

// --- CHANGED: added a `query` label so latency can be broken down per query
// site (e.g. "getPortfolioByWallet"). Keep this label to a small, fixed set
// of call-site names — never pass raw SQL text as the label value, since
// that creates unbounded cardinality and will blow up Prometheus storage.
export const dbQueryDuration = new client.Histogram({
  name: 'db_query_duration',
  help: 'Duration of database queries',
  labelNames: ['query'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2]
});

// --- NEW: connection pool gauges (backed by pg.Pool's own counters) ---
export const dbPoolActiveConnections = new client.Gauge({
  name: 'db_pool_active_connections',
  help: 'Number of connections currently checked out of the pool and in use'
});

export const dbPoolIdleConnections = new client.Gauge({
  name: 'db_pool_idle_connections',
  help: 'Number of connections sitting idle in the pool'
});

export const dbPoolMaxConnections = new client.Gauge({
  name: 'db_pool_max_connections',
  help: 'Configured maximum size of the connection pool'
});

// --- NEW: lock and deadlock gauges (backed by polling Postgres system views) ---
export const dbLockWaits = new client.Gauge({
  name: 'db_lock_waits',
  help: 'Current number of sessions waiting to acquire a lock'
});

export const dbDeadlocksTotal = new client.Gauge({
  name: 'db_deadlocks_total',
  help: 'Cumulative deadlock count reported by PostgreSQL for this database'
});

// Register all custom metrics
register.registerMetric(httpRequestDurationMicroseconds);
register.registerMetric(httpRequestsTotal);
register.registerMetric(loginAttemptsTotal);
register.registerMetric(loginFailuresTotal);
register.registerMetric(walletLookupTotal);
register.registerMetric(portfolioRequestsTotal);
register.registerMetric(portfolioRefreshTotal);
register.registerMetric(portfolioRefreshFailuresTotal);
register.registerMetric(aiAnalysisRequestsTotal);
register.registerMetric(aiAnalysisLatency);
register.registerMetric(cacheHitsTotal);
register.registerMetric(cacheMissesTotal);
register.registerMetric(externalApiLatency);
register.registerMetric(dbQueryDuration);
register.registerMetric(dbPoolActiveConnections);
register.registerMetric(dbPoolIdleConnections);
register.registerMetric(dbPoolMaxConnections);
register.registerMetric(dbLockWaits);
register.registerMetric(dbDeadlocksTotal);

// --- NEW: wire pool metrics ---
// Call this once, right after you construct your pg.Pool instance, passing
// the same `max` value you configured on the pool (pg's public TypeScript
// types don't expose `.options`, so we take it as an explicit argument
// instead of reading it back off the pool instance).
//   const maxConnections = 20;
//   const pool = new Pool({ ...config, max: maxConnections });
//   wirePoolMetrics(pool, maxConnections);
export function wirePoolMetrics(pool: Pool, maxConnections: number, intervalMs = 5000): void {
  dbPoolMaxConnections.set(maxConnections);

  // pg.Pool doesn't emit active/idle counts as events, so sample on an interval.
  setInterval(() => {
    dbPoolActiveConnections.set(pool.totalCount - pool.idleCount);
    dbPoolIdleConnections.set(pool.idleCount);
  }, intervalMs);
}

// --- NEW: wire lock/deadlock metrics ---
// Call this once alongside wirePoolMetrics(pool). Requires the pool's DB
// user to have permission to read pg_locks and pg_stat_database (default
// for most roles, including the table owner).
export function wireLockMetrics(pool: Pool, intervalMs = 10000): void {
  setInterval(async () => {
    try {
      const lockRes = await pool.query(
        `SELECT count(*) AS waiting FROM pg_locks WHERE NOT granted`
      );
      dbLockWaits.set(Number(lockRes.rows[0].waiting));

      const deadlockRes = await pool.query(
        `SELECT deadlocks FROM pg_stat_database WHERE datname = current_database()`
      );
      dbDeadlocksTotal.set(Number(deadlockRes.rows[0].deadlocks));
    } catch (err) {
      console.error('Failed to poll lock/deadlock metrics', err);
    }
  }, intervalMs);
}

export { register };