export interface PortfolioInsights {
  risk: string;
  diversificationScore: number;
  concentrationRisk: string;
  stablecoinExposure: number;
  assetAllocation: { asset: string; percentage: number }[];
  insights: string[];
}

export interface AIAnalyzer {
  analyze(walletData: any): Promise<PortfolioInsights>;
}
