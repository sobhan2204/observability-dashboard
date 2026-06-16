import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { registerUser, loginUser } from '../services/authService';
import { loginLimiter } from '../middlewares/rateLimiter';
import { logAudit } from '../services/securityService';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

router.post('/register', async (req, res, next) => {
  try {
    const { email, password } = registerSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await registerUser(email, passwordHash);
    
    await logAudit(user.id, 'USER_REGISTERED', { email }, req.ip || '');
    
    res.status(201).json({ id: user.id, email: user.email });
  } catch (error) {
    next(error);
  }
});

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = registerSchema.parse(req.body);
    const result = await loginUser(email, password, req.ip || '');
    
    if (!result) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await logAudit(result.user.id, 'USER_LOGGED_IN', { email }, req.ip || '');

    res.json({ token: result.token });
  } catch (error) {
    next(error);
  }
});

export default router;
