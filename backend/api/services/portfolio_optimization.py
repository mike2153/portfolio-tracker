# backend/api/services/portfolio_optimization.py
import logging
import numpy as np
from datetime import datetime
from typing import Dict, List, Any, Optional
from decimal import Decimal
from dataclasses import dataclass
from django.core.exceptions import ObjectDoesNotExist
from ..models import Portfolio, Holding
from ..alpha_vantage_service import get_alpha_vantage_service

logger = logging.getLogger(__name__)

@dataclass
class HoldingAnalysis:
    """Analysis data for a single holding"""
    ticker: str
    weight: float
    expected_return: float
    volatility: float
    beta: float
    sector: str
    market_cap: str
    current_value: float

@dataclass
class PortfolioMetrics:
    """Portfolio-level metrics"""
    total_value: float
    expected_return: float
    volatility: float
    sharpe_ratio: float
    beta: float
    var_95: float  # Value at Risk (95% confidence)
    max_drawdown: float

@dataclass
class DiversificationAnalysis:
    """Portfolio diversification metrics"""
    sector_concentration: Dict[str, float]
    geographic_concentration: Dict[str, float]
    market_cap_concentration: Dict[str, float]
    concentration_risk_score: float  # 0-100, higher = more concentrated
    number_of_holdings: int
    herfindahl_index: float

@dataclass
class RiskAssessment:
    """Comprehensive risk assessment"""
    overall_risk_score: float  # 0-100, higher = riskier
    volatility_risk: float
    concentration_risk: float
    correlation_risk: float
    liquidity_risk: float
    risk_factors: List[str]
    recommendations: List[str]

@dataclass
class OptimizationRecommendations:
    """Portfolio optimization recommendations"""
    rebalancing_suggestions: List[Dict[str, Any]]
    diversification_suggestions: List[str]
    risk_reduction_suggestions: List[str]
    potential_new_holdings: List[Dict[str, Any]]
    target_allocation: Dict[str, float]

class PortfolioOptimizationService:
    """Service for portfolio optimization and risk assessment"""
    
    def __init__(self):
        self.av_service = get_alpha_vantage_service()
        
        # Sector mappings (simplified - in production, use a comprehensive database)
        self.sector_mappings = {
            'AAPL': 'Technology', 'MSFT': 'Technology', 'GOOGL': 'Technology', 'AMZN': 'Technology',
            'TSLA': 'Consumer Cyclical', 'NVDA': 'Technology', 'META': 'Technology', 'NFLX': 'Technology',
            'JPM': 'Financial Services', 'BAC': 'Financial Services', 'WFC': 'Financial Services',
            'JNJ': 'Healthcare', 'PFE': 'Healthcare', 'UNH': 'Healthcare', 'MRNA': 'Healthcare',
            'XOM': 'Energy', 'CVX': 'Energy', 'COP': 'Energy',
            'WMT': 'Consumer Defensive', 'PG': 'Consumer Defensive', 'KO': 'Consumer Defensive',
            'DIS': 'Communication Services', 'VZ': 'Communication Services', 'T': 'Communication Services'
        }
        
        # Market cap classifications (simplified)
        self.market_cap_mappings = {
            'AAPL': 'Large Cap', 'MSFT': 'Large Cap', 'GOOGL': 'Large Cap', 'AMZN': 'Large Cap',
            'TSLA': 'Large Cap', 'NVDA': 'Large Cap', 'META': 'Large Cap', 'NFLX': 'Large Cap'
        }
    
    def analyze_portfolio(self, user_id: str) -> Dict[str, Any]:
        """
        Perform comprehensive portfolio analysis including optimization and risk assessment
        
        Args:
            user_id: User ID for portfolio lookup
            
        Returns:
            Complete analysis including metrics, risk assessment, and recommendations
        """
        logger.info(f"Starting comprehensive portfolio analysis for user {user_id}")
        
        try:
            portfolio = Portfolio.objects.get(user_id=user_id)
        except ObjectDoesNotExist:
            raise ValueError(f"Portfolio not found for user {user_id}")
        
        holdings = list(portfolio.holdings.all())
        if not holdings:
            return {
                'error': 'No holdings found in portfolio',
                'recommendations': ['Add holdings to your portfolio to begin analysis']
            }
        
        # Get current market data for all holdings
        holdings_data = self._get_holdings_market_data(holdings)
        
        # Calculate portfolio metrics
        portfolio_metrics = self._calculate_portfolio_metrics(holdings_data)
        
        # Analyze diversification
        diversification = self._analyze_diversification(holdings_data)
        
        # Assess risk
        risk_assessment = self._assess_portfolio_risk(holdings_data, portfolio_metrics, diversification)
        
        # Generate optimization recommendations
        optimization_recs = self._generate_optimization_recommendations(
            holdings_data, portfolio_metrics, diversification, risk_assessment
        )
        
        return {
            'portfolio_metrics': portfolio_metrics.__dict__,
            'holdings_analysis': [h.__dict__ for h in holdings_data],
            'diversification': diversification.__dict__,
            'risk_assessment': risk_assessment.__dict__,
            'optimization_recommendations': optimization_recs.__dict__,
            'analysis_date': datetime.now().isoformat(),
            'total_holdings': len(holdings_data)
        }
    
    def _get_holdings_market_data(self, holdings: List[Holding]) -> List[HoldingAnalysis]:
        """Get current market data and analysis for all holdings"""
        holdings_data = []
        total_portfolio_value = Decimal('0')
        
        # First pass: calculate total portfolio value
        for holding in holdings:
            try:
                quote = self.av_service.get_global_quote(str(holding.ticker))
                current_price = Decimal(str(quote['price'])) if quote and quote.get('price') else Decimal(str(holding.purchase_price))
                current_value = Decimal(str(holding.shares)) * current_price
                total_portfolio_value += current_value
            except Exception as e:
                logger.warning(f"Could not get current price for {holding.ticker}: {e}")
                current_value = Decimal(str(holding.shares)) * Decimal(str(holding.purchase_price))
                total_portfolio_value += current_value
        
        # Second pass: create analysis objects
        for holding in holdings:
            try:
                # Get current market data
                quote = self.av_service.get_global_quote(str(holding.ticker))
                overview = self.av_service.get_company_overview(str(holding.ticker))
                
                current_price = Decimal(str(quote['price'])) if quote and quote.get('price') else Decimal(str(holding.purchase_price))
                current_value = float(Decimal(str(holding.shares)) * current_price)
                weight = float(current_value / float(total_portfolio_value)) if total_portfolio_value > 0 else 0
                
                # Calculate expected return and volatility (simplified)
                expected_return = self._estimate_expected_return(str(holding.ticker), quote or {}, overview or {})
                volatility = self._estimate_volatility(str(holding.ticker), overview or {})
                beta = float(overview.get('Beta', 1.0)) if overview else 1.0
                
                # Get sector and market cap
                sector = self.sector_mappings.get(str(holding.ticker), 'Unknown')
                market_cap = self._classify_market_cap(overview.get('MarketCapitalization') if overview else None)
                
                holding_analysis = HoldingAnalysis(
                    ticker=str(holding.ticker),
                    weight=weight,
                    expected_return=expected_return,
                    volatility=volatility,
                    beta=beta,
                    sector=sector,
                    market_cap=market_cap,
                    current_value=current_value
                )
                
                holdings_data.append(holding_analysis)
                
            except Exception as e:
                logger.error(f"Error analyzing holding {holding.ticker}: {e}")
                # Add basic analysis even if we can't get market data
                current_value = float(Decimal(str(holding.shares)) * Decimal(str(holding.purchase_price)))
                weight = float(current_value / float(total_portfolio_value)) if total_portfolio_value > 0 else 0
                
                holdings_data.append(HoldingAnalysis(
                    ticker=str(holding.ticker),
                    weight=weight,
                    expected_return=0.08,  # Default expected return
                    volatility=0.20,  # Default volatility
                    beta=1.0,
                    sector=self.sector_mappings.get(str(holding.ticker), 'Unknown'),
                    market_cap='Unknown',
                    current_value=current_value
                ))
        
        return holdings_data
    
    def _calculate_portfolio_metrics(self, holdings_data: List[HoldingAnalysis]) -> PortfolioMetrics:
        """Calculate portfolio-level metrics"""
        if not holdings_data:
            return PortfolioMetrics(0, 0, 0, 0, 0, 0, 0)
        
        # Portfolio value
        total_value = sum(h.current_value for h in holdings_data)
        
        # Weighted average expected return
        expected_return = sum(h.weight * h.expected_return for h in holdings_data)
        
        # Portfolio volatility (simplified - assumes some correlation)
        # In a full implementation, you'd calculate the covariance matrix
        weighted_volatilities = [h.weight * h.volatility for h in holdings_data]
        portfolio_volatility = np.sqrt(sum(v**2 for v in weighted_volatilities))
        
        # Portfolio beta
        portfolio_beta = sum(h.weight * h.beta for h in holdings_data)
        
        # Sharpe ratio (assuming 2% risk-free rate)
        risk_free_rate = 0.02
        sharpe_ratio = (expected_return - risk_free_rate) / portfolio_volatility if portfolio_volatility > 0 else 0
        
        # Value at Risk (95% confidence, 1-day horizon)
        var_95 = total_value * 1.645 * portfolio_volatility / np.sqrt(252)  # Daily VaR
        
        # Max drawdown (simplified estimate based on volatility)
        max_drawdown = portfolio_volatility * 2.5  # Rough estimate
        
        return PortfolioMetrics(
            total_value=total_value,
            expected_return=expected_return,
            volatility=portfolio_volatility,
            sharpe_ratio=sharpe_ratio,
            beta=portfolio_beta,
            var_95=var_95,
            max_drawdown=max_drawdown
        )
    
    def _analyze_diversification(self, holdings_data: List[HoldingAnalysis]) -> DiversificationAnalysis:
        """Analyze portfolio diversification"""
        if not holdings_data:
            return DiversificationAnalysis({}, {}, {}, 100, 0, 1.0)
        
        # Sector concentration
        sector_weights = {}
        for holding in holdings_data:
            sector = holding.sector
            sector_weights[sector] = sector_weights.get(sector, 0) + holding.weight
        
        # Geographic concentration (simplified - assume US for now)
        geographic_weights = {'United States': 1.0}
        
        # Market cap concentration
        market_cap_weights = {}
        for holding in holdings_data:
            market_cap = holding.market_cap
            market_cap_weights[market_cap] = market_cap_weights.get(market_cap, 0) + holding.weight
        
        # Herfindahl Index (concentration measure)
        herfindahl_index = sum(w**2 for w in [h.weight for h in holdings_data])
        
        # Concentration risk score (0-100, higher = more concentrated)
        # Based on number of holdings and Herfindahl index
        num_holdings = len(holdings_data)
        if num_holdings == 1:
            concentration_risk = 100
        elif num_holdings < 5:
            concentration_risk = 80
        elif num_holdings < 10:
            concentration_risk = 60
        elif num_holdings < 20:
            concentration_risk = 40
        else:
            concentration_risk = 20
        
        # Adjust based on sector concentration
        max_sector_weight = max(sector_weights.values()) if sector_weights else 0
        if max_sector_weight > 0.5:
            concentration_risk += 20
        elif max_sector_weight > 0.3:
            concentration_risk += 10
        
        concentration_risk = min(100, concentration_risk)
        
        return DiversificationAnalysis(
            sector_concentration=sector_weights,
            geographic_concentration=geographic_weights,
            market_cap_concentration=market_cap_weights,
            concentration_risk_score=concentration_risk,
            number_of_holdings=num_holdings,
            herfindahl_index=herfindahl_index
        )
    
    def _assess_portfolio_risk(
        self, 
        holdings_data: List[HoldingAnalysis], 
        portfolio_metrics: PortfolioMetrics,
        diversification: DiversificationAnalysis
    ) -> RiskAssessment:
        """Assess overall portfolio risk"""
        risk_factors = []
        recommendations = []
        
        # Volatility risk (0-40 points)
        if portfolio_metrics.volatility > 0.25:
            volatility_risk = 40
            risk_factors.append("High portfolio volatility")
            recommendations.append("Consider adding lower-volatility assets")
        elif portfolio_metrics.volatility > 0.18:
            volatility_risk = 25
            risk_factors.append("Moderate portfolio volatility")
        else:
            volatility_risk = 10
        
        # Concentration risk (0-30 points)
        concentration_risk = min(30, diversification.concentration_risk_score * 0.3)
        if diversification.concentration_risk_score > 70:
            risk_factors.append("High concentration risk")
            recommendations.append("Diversify across more holdings and sectors")
        
        # Correlation risk (0-20 points) - simplified
        correlation_risk = 10  # Default moderate correlation risk
        max_sector_weight = max(diversification.sector_concentration.values()) if diversification.sector_concentration else 0
        if max_sector_weight > 0.5:
            correlation_risk = 20
            risk_factors.append("High sector concentration")
            recommendations.append("Reduce exposure to overweighted sectors")
        
        # Liquidity risk (0-10 points) - simplified
        liquidity_risk = 5  # Default low liquidity risk for public equities
        
        # Overall risk score
        overall_risk = volatility_risk + concentration_risk + correlation_risk + liquidity_risk
        
        # Additional recommendations based on analysis
        if diversification.number_of_holdings < 10:
            recommendations.append("Consider adding more holdings to improve diversification")
        
        if portfolio_metrics.sharpe_ratio < 0.5:
            recommendations.append("Portfolio risk-adjusted returns could be improved")
        
        return RiskAssessment(
            overall_risk_score=min(100, overall_risk),
            volatility_risk=volatility_risk,
            concentration_risk=concentration_risk,
            correlation_risk=correlation_risk,
            liquidity_risk=liquidity_risk,
            risk_factors=risk_factors,
            recommendations=recommendations
        )
    
    def _generate_optimization_recommendations(
        self,
        holdings_data: List[HoldingAnalysis],
        portfolio_metrics: PortfolioMetrics,
        diversification: DiversificationAnalysis,
        risk_assessment: RiskAssessment
    ) -> OptimizationRecommendations:
        """Generate portfolio optimization recommendations"""
        rebalancing_suggestions = []
        diversification_suggestions = []
        risk_reduction_suggestions = []
        potential_new_holdings = []
        
        # Rebalancing suggestions
        for holding in holdings_data:
            if holding.weight > 0.15:  # Over 15% allocation
                rebalancing_suggestions.append({
                    'ticker': holding.ticker,
                    'current_weight': holding.weight,
                    'suggested_action': 'reduce',
                    'suggested_weight': 0.10,
                    'reason': 'Reduce concentration risk'
                })
        
        # Diversification suggestions
        represented_sectors = set(diversification.sector_concentration.keys())
        missing_sectors = {'Healthcare', 'Financial Services', 'Consumer Defensive', 'Energy'} - represented_sectors
        
        for sector in missing_sectors:
            diversification_suggestions.append(f"Consider adding exposure to {sector} sector")
        
        # Risk reduction suggestions
        if portfolio_metrics.volatility > 0.20:
            risk_reduction_suggestions.append("Add defensive stocks or bonds to reduce volatility")
        
        if diversification.concentration_risk_score > 60:
            risk_reduction_suggestions.append("Increase number of holdings to reduce concentration risk")
        
        # Potential new holdings (simplified recommendations)
        if 'Healthcare' not in represented_sectors:
            potential_new_holdings.append({
                'ticker': 'JNJ',
                'sector': 'Healthcare',
                'reason': 'Add healthcare sector exposure',
                'suggested_weight': 0.05
            })
        
        if 'Consumer Defensive' not in represented_sectors:
            potential_new_holdings.append({
                'ticker': 'PG',
                'sector': 'Consumer Defensive',
                'reason': 'Add defensive exposure',
                'suggested_weight': 0.05
            })
        
        # Target allocation (simplified equal-weight approach)
        num_holdings = len(holdings_data)
        target_weight = 1.0 / max(num_holdings, 10)  # Assume minimum 10 holdings
        target_allocation = {h.ticker: target_weight for h in holdings_data}
        
        return OptimizationRecommendations(
            rebalancing_suggestions=rebalancing_suggestions,
            diversification_suggestions=diversification_suggestions,
            risk_reduction_suggestions=risk_reduction_suggestions,
            potential_new_holdings=potential_new_holdings,
            target_allocation=target_allocation
        )
    
    def _estimate_expected_return(self, ticker: str, quote: Dict, overview: Dict) -> float:
        """Estimate expected return for a stock (simplified)"""
        # This is a simplified implementation
        # In production, you'd use more sophisticated models
        
        if not quote or not overview:
            return 0.08  # Default market return
        
        try:
            # Use P/E ratio and dividend yield as rough indicators
            pe_ratio = float(overview.get('PERatio', 20))
            dividend_yield = float(overview.get('DividendYield', 0))
            
            # Simple heuristic: lower P/E might indicate higher expected returns
            pe_factor = max(0.05, 0.15 - (pe_ratio - 15) * 0.002)
            
            expected_return = pe_factor + dividend_yield
            return min(0.20, max(0.02, expected_return))  # Cap between 2% and 20%
            
        except (ValueError, TypeError):
            return 0.08
    
    def _estimate_volatility(self, ticker: str, overview: Dict) -> float:
        """Estimate volatility for a stock (simplified)"""
        if not overview:
            return 0.20  # Default volatility
        
        try:
            beta = float(overview.get('Beta', 1.0))
            # Rough volatility estimate based on beta
            market_volatility = 0.16  # Assume 16% market volatility
            estimated_volatility = abs(beta) * market_volatility
            
            return min(0.50, max(0.10, estimated_volatility))  # Cap between 10% and 50%
            
        except (ValueError, TypeError):
            return 0.20
    
    def _classify_market_cap(self, market_cap_str: Optional[str]) -> str:
        """Classify market cap into categories"""
        if not market_cap_str or market_cap_str == 'None':
            return 'Unknown'
        
        try:
            market_cap = float(market_cap_str)
            if market_cap > 200_000_000_000:  # > $200B
                return 'Mega Cap'
            elif market_cap > 10_000_000_000:  # > $10B
                return 'Large Cap'
            elif market_cap > 2_000_000_000:  # > $2B
                return 'Mid Cap'
            elif market_cap > 300_000_000:  # > $300M
                return 'Small Cap'
            else:
                return 'Micro Cap'
        except (ValueError, TypeError):
            return 'Unknown'

# Singleton instance
_portfolio_optimization_service_instance = None

def get_portfolio_optimization_service() -> PortfolioOptimizationService:
    """Get singleton instance of PortfolioOptimizationService"""
    global _portfolio_optimization_service_instance
    if _portfolio_optimization_service_instance is None:
        _portfolio_optimization_service_instance = PortfolioOptimizationService()
    return _portfolio_optimization_service_instance 