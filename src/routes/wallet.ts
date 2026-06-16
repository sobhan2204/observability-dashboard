import { Router } from 'express';
import { z } from 'zod';
import { addWallet, getWallets, removeWallet } from '../services/walletService';
import { authenticateToken, AuthRequest } from '../middlewares/auth';
import { logAudit } from '../services/securityService';

const router = Router();

const walletSchema = z.object({
  address: z.string().min(5),
  network: z.string().min(3),
});

router.use(authenticateToken);

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const { address, network } = walletSchema.parse(req.body);
    const userId = req.user!.id;
    
    const wallet = await addWallet(userId, address, network, req.ip || '');
    await logAudit(userId, 'WALLET_ADDED', { address, network }, req.ip || '');
    
    res.status(201).json(wallet);
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const wallets = await getWallets(userId);
    res.json(wallets);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const walletId = req.params.id;
    
    await removeWallet(userId, walletId);
    await logAudit(userId, 'WALLET_REMOVED', { walletId }, req.ip || '');
    
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
