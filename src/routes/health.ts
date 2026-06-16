import { Router } from 'express';
import { prisma, redis } from '../db';

const router = Router();

router.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP' });
});

router.get('/live', (req, res) => {
  res.status(200).json({ status: 'UP' });
});

router.get('/ready', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await redis.ping();
    res.status(200).json({ status: 'UP' });
  } catch (error) {
    res.status(503).json({ status: 'DOWN', error: (error as any).message });
  }
});

export default router;
