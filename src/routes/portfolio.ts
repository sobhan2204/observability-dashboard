import { Router } from 'express';
import { trace } from '@opentelemetry/api';
import { prisma } from '../db';
import { getPortfolioValue, getPortfolioHistory, getPortfolioPerformance, getWalletData } from '../services/portfolioService';
import { authenticateToken, AuthRequest } from '../middlewares/auth';
import { logAudit } from '../services/securityService';
import { container } from '../services/ai';
import { AIAnalyzer } from '../services/ai/AIAnalyzer';
import { aiAnalysisRequestsTotal, aiAnalysisLatency } from '../metrics';

const router = Router();
const tracer = trace.getTracer('portfolio-route');

router.use(authenticateToken);

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const portfolio = await getPortfolioValue(userId);
    
    await logAudit(userId, 'PORTFOLIO_VIEWED', { totalValueUSD: portfolio.totalValueUSD }, req.ip || '');
    
    res.json(portfolio);
  } catch (error) {
    next(error);
  }
});

router.get('/history/:walletId', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { walletId } = req.params;

    // Verify ownership
    const wallet = await prisma.wallet.findUnique({ where: { id: walletId } });
    if (!wallet || wallet.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden: You do not own this wallet' });
    }

    const history = await getPortfolioHistory(walletId);
    res.json(history);
  } catch (error) {
    next(error);
  }
});

router.get('/performance/:walletId', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { walletId } = req.params;

    // Verify ownership
    const wallet = await prisma.wallet.findUnique({ where: { id: walletId } });
    if (!wallet || wallet.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden: You do not own this wallet' });
    }

    const performance = await getPortfolioPerformance(walletId);
    res.json(performance);
  } catch (error) {
    next(error);
  }
});

router.get('/insights/:walletId', async (req: AuthRequest, res, next) => {
  const endTimer = aiAnalysisLatency.startTimer();
  return tracer.startActiveSpan('generate_portfolio_insights', async (span) => {
    try {
      const userId = req.user!.id;
      const { walletId } = req.params;

      // Verify ownership
      const wallet = await prisma.wallet.findUnique({ where: { id: walletId } });
      if (!wallet || wallet.userId !== userId) {
        endTimer();
        span.end();
        return res.status(403).json({ error: 'Forbidden: You do not own this wallet' });
      }

      aiAnalysisRequestsTotal.inc();
      const walletData = await getWalletData(walletId);
      
      const analyzer = container.resolve<AIAnalyzer>('AIAnalyzer');
      const insights = await analyzer.analyze(walletData);
      
      endTimer();
      span.end();
      res.json(insights);
    } catch (error) {
      endTimer();
      span.recordException(error as Error);
      span.end();
      next(error);
    }
  });
});

export default router;
