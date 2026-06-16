import client from 'prom-client';

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

export const dbQueryDuration = new client.Histogram({
  name: 'db_query_duration',
  help: 'Duration of database queries',
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2]
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

export { register };
