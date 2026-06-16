import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { apiLimiter } from './middlewares/rateLimiter';
import { errorHandler } from './middlewares/errorHandler';
import { metricsMiddleware } from './middlewares/metricsMiddleware';

import authRoutes from './routes/auth';
import walletRoutes from './routes/wallet';
import portfolioRoutes from './routes/portfolio';
import healthRoutes from './routes/health';
import metricsRoutes from './routes/metrics';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

// Metrics middleware applied before routes
app.use(metricsMiddleware);

// Global rate limiter
app.use('/api/', apiLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/wallets', walletRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/', healthRoutes);
app.use('/metrics', metricsRoutes);

app.use(errorHandler);

export default app;
