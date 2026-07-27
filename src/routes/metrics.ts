import { Router } from 'express';
import { register } from '../metrics';
import { prisma } from '../db';
import logger from '../logger';

const router = Router();

router.get('/', async (req, res) => {
  res.set('Content-Type', register.contentType);
  let body = await register.metrics();

  // Append Prisma's own metrics (prisma_pool_connections_*,
  // prisma_client_queries_wait_histogram_ms - pool acquisition time,
  // prisma_client_queries_duration_histogram_ms) in their native exposition
  // format. wirePrismaPoolMetrics() only re-publishes the pool gauges under
  // our own names; the acquisition-time histogram is exposed here as-is
  // since converting Prisma's pre-aggregated buckets into prom-client
  // Histogram.observe() calls would lose data.
  try {
    body += '\n' + (await prisma.$metrics.prometheus());
  } catch (err) {
    logger.error('Failed to append Prisma metrics', { err });
  }

  res.end(body);
});

export default router;
