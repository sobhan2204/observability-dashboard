import 'reflect-metadata';
import { DeterministicAnalyzer } from '../services/ai/DeterministicAnalyzer';

describe('DeterministicAnalyzer', () => {
  let analyzer: DeterministicAnalyzer;

  beforeEach(() => {
    analyzer = new DeterministicAnalyzer();
  });

  it('should calculate high risk for concentrated portfolio', async () => {
    const walletData = {
      balance: 10,
      priceUSD: 2000,
      valueUSD: 20000,
      tokens: []
    };

    const result = await analyzer.analyze(walletData);
    expect(result.risk).toBe('High');
    expect(result.concentrationRisk).toBe('High');
    expect(result.diversificationScore).toBeLessThan(40);
  });

  it('should calculate low risk for diversified portfolio', async () => {
    const walletData = {
      balance: 1,
      priceUSD: 2000,
      valueUSD: 10000,
      tokens: [
        { symbol: 'USDT', balance: 5000 },
        { symbol: 'USDC', balance: 1000 },
        { symbol: 'DAI', balance: 1000 },
        { symbol: 'LINK', balance: 1000 }
      ]
    };

    const result = await analyzer.analyze(walletData);
    expect(result.diversificationScore).toBeGreaterThanOrEqual(80);
    expect(result.insights).toContain('Portfolio has healthy diversification across assets.');
  });
});
