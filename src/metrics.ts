import client from 'prom-client';
import type { PrismaClient } from '@prisma/client';
import logger from './logger';

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

// --- Connection pool gauges. Prisma manages its own pool internally (there
// is no raw pg.Pool anywhere in this app - see src/db.ts), so these are
// populated from Prisma's own metrics API (prisma.$metrics), not by polling
// a Pool object directly. See wirePrismaPoolMetrics() below. ---
export const dbPoolActiveConnections = new client.Gauge({
  name: 'db_pool_active_connections',
  help: 'Number of Prisma pool connections currently checked out and running a query'
});

export const dbPoolIdleConnections = new client.Gauge({
  name: 'db_pool_idle_connections',
  help: 'Number of Prisma pool connections open but idle'
});

export const dbPoolWaitingClients = new client.Gauge({
  name: 'db_pool_waiting_clients',
  help: 'Number of queries currently queued waiting for a free pool connection'
});

export const dbPoolMaxConnections = new client.Gauge({
  name: 'db_pool_max_connections',
  help: 'Configured maximum size of the connection pool (Prisma connection_limit)'
});

// Lock waits and deadlocks are collected server-side by postgres_exporter
// (pg_locks_waiting_total, pg_stat_database_deadlocks) instead of being
// polled from the app - see postgres-exporter-queries.yaml. That avoids
// duplicating the same pg_locks/pg_stat_database polling in two places and
// keeps it working even when the app process is down.

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
register.registerMetric(dbPoolWaitingClients);
register.registerMetric(dbPoolMaxConnections);

interface PrismaMetricEntry {
  key: string;
  value: number;
  labels?: Record<string, string>;
}

interface PrismaMetricsJson {
  counters: PrismaMetricEntry[];
  gauges: PrismaMetricEntry[];
  histograms: unknown[];
}

const sumGaugeByKeySubstring = (gauges: PrismaMetricEntry[], needle: string): number =>
  gauges.filter((g) => g.key.includes(needle)).reduce((total, g) => total + g.value, 0);

// Prisma manages its own internal connection pool and exposes its state via
// prisma.$metrics (preview feature enabled in prisma/schema.prisma) rather
// than a pg.Pool we could poll directly. This samples that API on an
// interval and republishes the numbers under our own gauge names so
// Grafana/Prometheus don't need to know Prisma's internal metric naming.
export function wirePrismaPoolMetrics(prisma: PrismaClient, maxConnections: number, intervalMs = 5000): void {
  dbPoolMaxConnections.set(maxConnections);

  setInterval(async () => {
    try {
      const metrics = (await prisma.$metrics.json()) as PrismaMetricsJson;
      dbPoolActiveConnections.set(sumGaugeByKeySubstring(metrics.gauges, 'connections_busy'));
      dbPoolIdleConnections.set(sumGaugeByKeySubstring(metrics.gauges, 'connections_idle'));
      dbPoolWaitingClients.set(sumGaugeByKeySubstring(metrics.gauges, 'connections_waiting'));
    } catch (err) {
      logger.error('Failed to poll Prisma pool metrics', { err });
    }
  }, intervalMs);
}

export { register };