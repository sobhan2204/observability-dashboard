import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { prisma } from '../db';
import { getPortfolioValue } from '../services/portfolioService';
import logger from '../logger';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

export const portfolioWorker = new Worker('portfolio-refresh', async job => {
  if (job.name === 'refresh-all-wallets') {
    logger.info('Starting background portfolio refresh for all users');
    
    const users = await prisma.user.findMany({
      select: { id: true }
    });

    for (const user of users) {
      try {
        await getPortfolioValue(user.id);
        logger.info(`Refreshed portfolio for user ${user.id}`);
      } catch (error) {
        logger.error(`Failed to refresh portfolio for user ${user.id}`, { error });
      }
    }
  }
}, { connection });

portfolioWorker.on('completed', job => {
  logger.info(`Job ${job.id} completed`);
});

portfolioWorker.on('failed', (job, err) => {
  logger.error(`Job ${job?.id} failed with ${err.message}`);
});
