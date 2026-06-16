import { prisma } from '../db';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { loginAttemptsTotal, loginFailuresTotal, dbQueryDuration } from '../metrics';
import { logSecurityEvent } from './securityService';

export const registerUser = async (email: string, passwordHash: string) => {
  const endTimer = dbQueryDuration.startTimer();
  const user = await prisma.user.create({
    data: {
      email,
      password: passwordHash,
    },
  });
  endTimer();
  return user;
};

export const loginUser = async (email: string, passwordRaw: string, ip: string) => {
  loginAttemptsTotal.inc();
  const endTimer = dbQueryDuration.startTimer();
  const user = await prisma.user.findUnique({ where: { email } });
  endTimer();

  if (!user) {
    loginFailuresTotal.inc();
    await logSecurityEvent('LOGIN_FAILED', ip, { email, reason: 'User not found' });
    return null;
  }

  const isPasswordValid = await bcrypt.compare(passwordRaw, user.password);
  if (!isPasswordValid) {
    loginFailuresTotal.inc();
    await logSecurityEvent('LOGIN_FAILED', ip, { email, reason: 'Invalid password' });
    return null;
  }

  const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET || 'secret', {
    expiresIn: '1h',
  });

  return { user, token };
};
