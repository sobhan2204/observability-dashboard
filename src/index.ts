import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { connectDBs, prisma } from './db';
import logger from './logger';
import { wirePrismaPoolMetrics } from './metrics';
import { setupPortfolioJobs } from './queues/portfolioQueue';
import './workers/portfolioWorker'; // Start worker

const PORT = process.env.PORT || 3030;

// Prisma defaults connection_limit to (num_physical_cpus * 2 + 1) when unset,
// so the pool ceiling shown on dashboards must come from the same DATABASE_URL
// param rather than being hardcoded here.
const CONNECTION_LIMIT = Number(new URL(process.env.DATABASE_URL || '').searchParams.get('connection_limit')) || 10;

const startServer = async () => {
  await connectDBs();
  wirePrismaPoolMetrics(prisma, CONNECTION_LIMIT);

  await setupPortfolioJobs();
  logger.info('Background portfolio jobs scheduled');

  app.listen(PORT, () => {
    logger.info(`Server listening on port ${PORT}`);
  });
};

startServer().catch((error) => {
  logger.error('Failed to start server', { error });
  process.exit(1);
});
