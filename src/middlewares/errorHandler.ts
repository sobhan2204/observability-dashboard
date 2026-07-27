import { Request, Response, NextFunction } from 'express';
import logger from '../logger';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  if (statusCode >= 400 && statusCode < 500) {
    logger.warn('Client Error', {
      error: message,
      path: req.path,
      method: req.method,
    });
  } else {
    logger.error('Server Error', {
      error: message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });
  }

  res.status(statusCode).json({
    error: message,
  });
};