"""
Alpha Vantage News & Sentiment API integration
"""
from typing import Dict, Any, List, Optional
from datetime import datetime
from decimal import Decimal

from debug_logger import DebugLogger
from .vantage_api_client import get_vantage_client

@DebugLogger.log_api_call(api_name="ALPHA_VANTAGE", sender="BACKEND", receiver="VANTAGE_API", operation="NEWS_SENTIMENT")
async def vantage_api_get_news_sentiment(
    ticker: str,
    limit: int = 50,
    time_from: Optional[str] = None,
    time_to: Optional[str] = None
) -> Dict[str, Any]:
    """
    Fetch news and sentiment data from Alpha Vantage NEWS_SENTIMENT API
    
    Args:
        ticker: Stock ticker symbol
        limit: Maximum number of articles (default 50, max 1000)
        time_from: Start date in YYYYMMDDTHHMM format
        time_to: End date in YYYYMMDDTHHMM format
        
    Returns:
        Dict containing news articles with sentiment analysis
    """
    client = get_vantage_client()
    
    # Check cache first
    cache_key = f"news:{ticker}:{limit}"
    cached_data = await client._get_from_cache(cache_key)
    
    if cached_data:
        return {
            'ok': True,
            'data': cached_data
        }
    
    params = {
        'function': 'NEWS_SENTIMENT',
        'tickers': ticker.upper(),
        'limit': str(min(limit, 1000)),
        'sort': 'LATEST'
    }
    
    if time_from:
        params['time_from'] = time_from
    if time_to:
        params['time_to'] = time_to
    
    try:
        raw_data = await client._make_request(params)
        
        # Process and structure the news data
        feed = raw_data.get('feed', [])
        
        articles = []
        for article in feed:
            # Extract ticker-specific sentiment
            ticker_sentiment = None
            for ts in article.get('ticker_sentiment', []):
                if ts.get('ticker') == ticker.upper():
                    ticker_sentiment = ts
                    break
            
            # Structure article data with type safety
            processed_article = {
                'title': article.get('title', ''),
                'url': article.get('url', ''),
                'time_published': article.get('time_published', ''),
                'authors': article.get('authors', []),
                'summary': article.get('summary', ''),
                'banner_image': article.get('banner_image', ''),
                'source': article.get('source', ''),
                'source_domain': article.get('source_domain', ''),
                'overall_sentiment_label': article.get('overall_sentiment_label', 'Neutral'),
                'overall_sentiment_score': float(article.get('overall_sentiment_score', 0)),
                'topics': article.get('topics', []),
                'ticker_sentiment': ticker_sentiment
            }
            
            articles.append(processed_article)
        
        # Structure the response
        response_data = {
            'items': len(articles),
            'articles': articles,
            'sentiment_score_definition': raw_data.get('sentiment_score_definition', ''),
            'relevance_score_definition': raw_data.get('relevance_score_definition', '')
        }
        
        # Cache the result
        await client._save_to_cache(cache_key, response_data)
        
        return {
            'ok': True,
            'data': response_data
        }
        
    except Exception as e:
        DebugLogger.log_error(
            file_name="vantage_api_news.py",
            function_name="vantage_api_get_news_sentiment",
            error=e,
            ticker=ticker
        )
        return {
            'ok': False,
            'error': f'Failed to fetch news: {str(e)}'
        }
