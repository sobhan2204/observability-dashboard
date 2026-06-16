import { ethers } from 'ethers';
import { prisma } from '../db';
import { walletLookupTotal, dbQueryDuration } from '../metrics';
import { logSecurityEvent } from './securityService';

export const addWallet = async (userId: string, address: string, network: string, ip: string) => {
  const endTimer = dbQueryDuration.startTimer();
  try {
    // Validate Ethereum address if network is ethereum
    if (network.toLowerCase() === 'ethereum') {
      if (!ethers.isAddress(address)) {
        throw new Error('Invalid Ethereum address');
      }
    }

    const wallet = await prisma.wallet.create({
      data: {
        userId,
        address,
        network,
      },
    });
    endTimer();
    return wallet;
  } catch (error) {
    endTimer();
    await logSecurityEvent('WALLET_ADD_FAILED', ip, { userId, address, network, error: (error as any).message });
    throw error;
  }
};

export const getWallets = async (userId: string) => {
  walletLookupTotal.inc();
  const endTimer = dbQueryDuration.startTimer();
  const wallets = await prisma.wallet.findMany({
    where: { userId },
  });
  endTimer();
  return wallets;
};

export const removeWallet = async (userId: string, walletId: string) => {
  const endTimer = dbQueryDuration.startTimer();
  await prisma.wallet.delete({
    where: { id: walletId, userId },
  });
  endTimer();
};
