import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { connectDBs } from './db';
import logger from './logger';
import { setupPortfolioJobs } from './queues/portfolioQueue';
import './workers/portfolioWorker'; // Start worker

const PORT = process.env.PORT || 3030;

const startServer = async () => {
  await connectDBs();

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
