// Financial and portfolio-specific types for Portfolio Tracker

export interface AssetAllocation {
  symbol: string;
  name: string;
  percentage: number;
  value: number;
  change: number;
  changePercent: number;
  sector?: string;
  assetClass?: string;
}

export interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  dayChange: number;
  dayChangePercent: number;
  cashBalance: number;
  investedAmount: number;
  numberOfHoldings: number;
}

export interface PerformanceData {
  date: string;
  portfolioValue: number;
  benchmarkValue?: number;
  returns: number;
  cumulativeReturns: number;
  drawdown?: number;
}

export interface RiskMetrics {
  beta: number;
  alpha: number;
  sharpeRatio: number;
  sortinoRatio: number;
  informationRatio: number;
  trackingError: number;
  maxDrawdown: number;
  volatility: number;
  var95: number; // Value at Risk 95%
  cvar95: number; // Conditional Value at Risk 95%
}

export interface SectorAllocation {
  sector: string;
  percentage: number;
  value: number;
  change: number;
  changePercent: number;
  holdings: number;
}

export interface AssetClassAllocation {
  assetClass: string;
  percentage: number;
  value: number;
  change: number;
  changePercent: number;
  holdings: number;
}

export interface GeographicAllocation {
  region: string;
  country?: string;
  percentage: number;
  value: number;
  change: number;
  changePercent: number;
  holdings: number;
}

export interface DividendData {
  symbol: string;
  exDate: string;
  payDate: string;
  amount: number;
  frequency: 'Monthly' | 'Quarterly' | 'Semi-Annual' | 'Annual' | 'Special';
  yield: number;
  status: 'Upcoming' | 'Paid' | 'Declared';
}

export interface TransactionSummary {
  totalTransactions: number;
  buyTransactions: number;
  sellTransactions: number;
  dividendTransactions: number;
  totalBuyAmount: number;
  totalSellAmount: number;
  totalDividendAmount: number;
  avgTransactionSize: number;
}

export interface PortfolioComparison {
  portfolioId: string;
  portfolioName: string;
  totalValue: number;
  totalReturn: number;
  totalReturnPercent: number;
  yearToDateReturn: number;
  yearToDateReturnPercent: number;
  riskMetrics: RiskMetrics;
}

export interface BenchmarkComparison {
  benchmarkSymbol: string;
  benchmarkName: string;
  portfolioReturn: number;
  benchmarkReturn: number;
  alpha: number;
  beta: number;
  correlation: number;
  trackingError: number;
  informationRatio: number;
}

export interface PortfolioOptimization {
  currentWeights: Record<string, number>;
  suggestedWeights: Record<string, number>;
  expectedReturn: number;
  expectedRisk: number;
  sharpeRatio: number;
  rebalanceRequired: boolean;
  rebalanceAmount: number;
}

export interface StressTestResult {
  scenario: string;
  description: string;
  portfolioImpact: number;
  portfolioImpactPercent: number;
  worstHolding: {
    symbol: string;
    impact: number;
    impactPercent: number;
  };
  bestHolding: {
    symbol: string;
    impact: number;
    impactPercent: number;
  };
}

export interface CorrelationMatrix {
  symbols: string[];
  matrix: number[][];
}

export interface VolatilityData {
  symbol: string;
  period: string;
  volatility: number;
  historicalVolatility: number;
  impliedVolatility?: number;
  ranking: number; // 1-100 percentile ranking
}

export interface LiquidityMetrics {
  symbol: string;
  averageDailyVolume: number;
  bidAskSpread: number;
  marketCap: number;
  liquidityScore: number; // 1-100 score
  daysToLiquidate: number; // At 20% of daily volume
}

export interface ESGScore {
  symbol: string;
  environmentalScore: number;
  socialScore: number;
  governanceScore: number;
  overallScore: number;
  rating: 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'CCC';
  lastUpdated: string;
}

export interface TaxLossHarvesting {
  symbol: string;
  currentValue: number;
  unrealizedLoss: number;
  taxSavings: number;
  washSaleRisk: boolean;
  replacementSuggestions: string[];
  harvestDate: string;
}

export interface RebalancingRecommendation {
  symbol: string;
  currentWeight: number;
  targetWeight: number;
  deviation: number;
  action: 'Buy' | 'Sell' | 'Hold';
  amount: number;
  priority: 'High' | 'Medium' | 'Low';
}

export interface CurrencyExposure {
  currency: string;
  exposure: number;
  exposurePercent: number;
  hedged: boolean;
  hedgeRatio?: number;
}

export interface PortfolioInsight {
  type: 'Performance' | 'Risk' | 'Allocation' | 'Tax' | 'Rebalancing';
  severity: 'Info' | 'Warning' | 'Critical';
  title: string;
  description: string;
  recommendation?: string;
  impact?: number;
  actionRequired: boolean;
  dueDate?: string;
}

export interface PortfolioGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'On Track' | 'Behind' | 'Ahead' | 'At Risk';
  monthlyContribution: number;
  projectedCompletion: string;
}