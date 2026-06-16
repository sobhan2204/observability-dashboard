import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';
import logger from './logger';

export const prisma = new PrismaClient();

export const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redis.on('error', (err) => logger.error('Redis Client Error', { err }));

export const connectDBs = async () => {
  try {
    await prisma.$connect();
    logger.info('Connected to PostgreSQL via Prisma');
    await redis.connect();
    logger.info('Connected to Redis');
  } catch (error) {
    logger.error('Database connection failed', { error });
    process.exit(1);
  }
};
