import { prisma } from '../db';
import logger from '../logger';

export const logSecurityEvent = async (eventType: string, ip: string, details: any) => {
  logger.warn(`Security Event: ${eventType}`, { ip, details });
  
  try {
    await prisma.securityEvent.create({
      data: {
        eventType,
        ip,
        details,
      },
    });
  } catch (error) {
    logger.error('Failed to log security event to DB', { error });
  }
};

export const logAudit = async (userId: string | null, action: string, details: any, ip: string) => {
  logger.info(`Audit: ${action}`, { userId, ip, details });

  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        details,
        ip,
      },
    });
  } catch (error) {
    logger.error('Failed to write audit log to DB', { error });
  }
};
