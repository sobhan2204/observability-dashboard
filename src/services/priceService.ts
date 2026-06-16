import axios from 'axios';
import { redis } from '../db';
import { externalApiLatency, cacheHitsTotal, cacheMissesTotal } from '../metrics';
import logger from '../logger';

const COINGECKO_API_URL = process.env.COINGECKO_API_URL || 'https://api.coingecko.com/api/v3';

export const getPrice = async (coinId: string): Promise<number> => {
  const cacheKey = `price:${coinId}`;
  
  try {
    const cachedPrice = await redis.get(cacheKey);
    if (cachedPrice) {
      cacheHitsTotal.inc();
      return parseFloat(cachedPrice);
    }
  } catch (error) {
    logger.error('Redis get error', { error });
  }

  cacheMissesTotal.inc();
  const endTimer = externalApiLatency.startTimer();
  
  try {
    const response = await axios.get(`${COINGECKO_API_URL}/simple/price?ids=${coinId}&vs_currencies=usd`);
    endTimer();
    
    const price = response.data[coinId]?.usd || 0;
    
    try {
      await redis.setEx(cacheKey, 300, price.toString()); // Cache for 5 minutes
    } catch (error) {
      logger.error('Redis set error', { error });
    }
    
    return price;
  } catch (error) {
    endTimer();
    logger.error('Error fetching price from CoinGecko', { error });
    return 0; // Fallback
  }
};
