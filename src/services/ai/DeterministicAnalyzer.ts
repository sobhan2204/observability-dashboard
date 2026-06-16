import { injectable } from 'tsyringe';
import { AIAnalyzer, PortfolioInsights } from './AIAnalyzer';

@injectable()
export class DeterministicAnalyzer implements AIAnalyzer {
  async analyze(walletData: any): Promise<PortfolioInsights> {
    const { balance, tokens, valueUSD } = walletData;
    
    const insights: string[] = [];
    const assetAllocation = [];
    
    let ethValue = balance * walletData.priceUSD;
    let stableValue = 0;
    
    assetAllocation.push({ asset: 'ETH', percentage: valueUSD === 0 ? 0 : (ethValue / valueUSD) * 100 });
    
    for (const token of tokens) {
      const tokenValue = token.balance * (token.symbol === 'USDT' ? 1 : 0); // Simplified
      assetAllocation.push({ asset: token.symbol, percentage: valueUSD === 0 ? 0 : (tokenValue / valueUSD) * 100 });
      if (['USDT', 'USDC', 'DAI'].includes(token.symbol)) {
        stableValue += tokenValue;
      }
    }

    const stablecoinExposure = valueUSD === 0 ? 0 : (stableValue / valueUSD) * 100;
    const diversificationScore = Math.min(assetAllocation.length * 20, 100);
    const concentrationRisk = assetAllocation.some(a => a.percentage > 70) ? 'High' : 'Low';
    
    if (concentrationRisk === 'High') {
      insights.push('Portfolio is highly concentrated in a single asset. Consider diversifying.');
    } else {
      insights.push('Portfolio has healthy diversification across assets.');
    }

    if (stablecoinExposure < 10) {
      insights.push('Low stablecoin exposure detected. Consider increasing for risk management.');
    }

    const risk = diversificationScore < 40 ? 'High' : diversificationScore < 70 ? 'Medium' : 'Low';

    return {
      risk,
      diversificationScore,
      concentrationRisk,
      stablecoinExposure,
      assetAllocation,
      insights
    };
  }
}
