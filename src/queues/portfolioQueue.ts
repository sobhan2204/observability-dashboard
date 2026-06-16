import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

export const portfolioQueue = new Queue('portfolio-refresh', { connection });

export const setupPortfolioJobs = async () => {
  await portfolioQueue.add('refresh-all-wallets', {}, {
    repeat: {
      pattern: '*/15 * * * *' // Every 15 minutes
    }
  });
};
