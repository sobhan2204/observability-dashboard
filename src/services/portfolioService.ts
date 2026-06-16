import { ethers } from 'ethers';
import axios from 'axios';
import { trace } from '@opentelemetry/api';
import { getWallets } from './walletService';
import { getPrice } from './priceService';
import { portfolioRequestsTotal } from '../metrics';
import { prisma } from '../db';
import { redis } from '../db';
import logger from '../logger';

const tracer = trace.getTracer('portfolio-service');
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || '';
const ETHERSCAN_API_URL = 'https://api.etherscan.io/api';

export const getPortfolioValue = async (userId: string) => {
  return tracer.startActiveSpan('getPortfolioValue', async (span) => {
    try {
      portfolioRequestsTotal.inc();
      const wallets = await getWallets(userId);
      
      let totalValueUSD = 0;
      const portfolioDetails = [];

      const provider = new ethers.EtherscanProvider('mainnet', ETHERSCAN_API_KEY);

      for (const wallet of wallets) {
        let balance = 0;
        let tokens: any[] = [];

        try {
          if (wallet.network.toLowerCase() === 'ethereum') {
            await tracer.startActiveSpan('fetch_eth_balance', async (ethSpan) => {
              const cacheKey = `balance:${wallet.address}`;
              const cachedBalance = await redis.get(cacheKey);

              if (cachedBalance) {
                balance = parseFloat(cachedBalance);
              } else {
                const ethBalanceRaw = await provider.getBalance(wallet.address);
                balance = parseFloat(ethers.formatEther(ethBalanceRaw));
                await redis.setEx(cacheKey, 300, balance.toString());
              }
              ethSpan.end();
            });

            await tracer.startActiveSpan('fetch_token_balances', async (tokenSpan) => {
              const usdtAddress = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
              const usdtBalance = await fetchTokenBalance(wallet.address, usdtAddress);
              if (usdtBalance > 0) {
                tokens.push({ symbol: 'USDT', balance: usdtBalance, address: usdtAddress });
              }
              tokenSpan.end();
            });
          } else {
            balance = 0;
          }
        } catch (error) {
          logger.error('Error fetching real wallet balance', { wallet: wallet.address, error });
          balance = 0;
        }
        
        const price = await tracer.startActiveSpan('fetch_prices', async (priceSpan) => {
          const coinId = wallet.network.toLowerCase() === 'ethereum' ? 'ethereum' : 'bitcoin';
          const p = await getPrice(coinId);
          priceSpan.end();
          return p;
        });
        
        let value = balance * price;
        
        for (const token of tokens) {
          const tokenPrice = await getPrice(token.symbol.toLowerCase() === 'usdt' ? 'tether' : '');
          value += token.balance * tokenPrice;
        }

        totalValueUSD += value;

        await prisma.portfolioSnapshot.create({
          data: {
            walletId: wallet.id,
            valueUsd: value
          }
        });

        portfolioDetails.push({
          walletId: wallet.id,
          address: wallet.address,
          network: wallet.network,
          balance,
          tokens,
          priceUSD: price,
          valueUSD: value
        });
      }

      span.end();
      return {
        totalValueUSD,
        wallets: portfolioDetails
      };
    } catch (error) {
      span.recordException(error as Error);
      span.end();
      throw error;
    }
  });
};

export const getPortfolioHistory = async (walletId: string) => {
  return await prisma.portfolioSnapshot.findMany({
    where: { walletId },
    orderBy: { createdAt: 'asc' }
  });
};

export const getPortfolioPerformance = async (walletId: string) => {
  const snapshots = await prisma.portfolioSnapshot.findMany({
    where: { walletId },
    orderBy: { createdAt: 'desc' },
    take: 2
  });

  if (snapshots.length < 2) {
    return { percentageChange: 0, absoluteChange: 0 };
  }

  const current = snapshots[0].valueUsd;
  const previous = snapshots[1].valueUsd;

  const absoluteChange = current - previous;
  const percentageChange = previous === 0 ? 0 : (absoluteChange / previous) * 100;

  return {
    percentageChange,
    absoluteChange,
    currentValue: current,
    previousValue: previous
  };
};

export const getWalletData = async (walletId: string) => {
  const wallet = await prisma.wallet.findUnique({
    where: { id: walletId }
  });

  if (!wallet) throw new Error('Wallet not found');

  let balance = 0;
  let tokens: any[] = [];
  let priceUSD = 0;

  try {
    const provider = new ethers.EtherscanProvider('mainnet', ETHERSCAN_API_KEY);

    if (wallet.network.toLowerCase() === 'ethereum') {
      const ethBalanceRaw = await provider.getBalance(wallet.address);
      balance = parseFloat(ethers.formatEther(ethBalanceRaw));

      const usdtAddress = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
      const usdtBalance = await fetchTokenBalance(wallet.address, usdtAddress);
      if (usdtBalance > 0) {
        tokens.push({ symbol: 'USDT', balance: usdtBalance });
      }
    }

    const coinId = wallet.network.toLowerCase() === 'ethereum' ? 'ethereum' : 'bitcoin';
    priceUSD = await getPrice(coinId);
  } catch (error) {
    logger.error('Error fetching wallet data for AI analysis', { walletId, error });
    // Continue with zeroed data if blockchain fetch fails
  }
  
  let valueUSD = balance * priceUSD;
  for (const token of tokens) {
    const tokenPrice = await getPrice(token.symbol.toLowerCase() === 'usdt' ? 'tether' : '');
    valueUSD += token.balance * tokenPrice;
  }

  return { balance, tokens, priceUSD, valueUSD };
};

async function fetchTokenBalance(address: string, contractAddress: string): Promise<number> {
  try {
    const url = `${ETHERSCAN_API_URL}?module=account&action=tokenbalance&contractaddress=${contractAddress}&address=${address}&tag=latest&apikey=${ETHERSCAN_API_KEY}`;
    const response = await axios.get(url);
    if (response.data.status === '1') {
      return parseFloat(response.data.result) / 1000000;
    }
    return 0;
  } catch (error) {
    logger.error('Error fetching token balance', { address, contractAddress, error });
    return 0;
  }
}
