"""
Stock symbol search with relevance scoring algorithm
Implements the same scoring logic as the original system
"""
from typing import List, Dict, Any
import logging

from .vantage_api_client import get_vantage_client
from debug_logger import DebugLogger

logger = logging.getLogger(__name__)

@DebugLogger.log_api_call(api_name="ALPHA_VANTAGE", sender="BACKEND", receiver="VANTAGE_API", operation="SYMBOL_SEARCH")
async def vantage_api_symbol_search(query: str, limit: int = 20) -> List[Dict[str, Any]]:
    """
    Search for stock symbols with intelligent scoring
    
    Scoring algorithm:
    - Exact ticker match: 100 points
    - Ticker prefix match: 75 points  
    - Ticker substring match: 50 points
    - Company name prefix match: 60 points
    - Company name substring match: 40 points
    - Short ticker penalty: -10 points
    """
    logger.info(f"[vantage_api_search.py::vantage_api_symbol_search] Searching for: {query}")
    
    if not query or len(query) < 1:
        return []
    
    # Normalize query for matching
    query_upper = query.upper()
    query_lower = query.lower()
    
    # Get Alpha Vantage client
    client = get_vantage_client()
    
    # Check cache first
    cache_key = f"symbol_search:{query_upper}"
    cached_results = await client._get_from_cache(cache_key)
    
    if cached_results:
        return cached_results[:limit]
    
    # Make API request
    params = {
        'function': 'SYMBOL_SEARCH',
        'keywords': query
    }
    
    try:
        response = await client._make_request(params)
        
        if 'bestMatches' not in response:
            logger.warning(f"[vantage_api_search.py::vantage_api_symbol_search] No matches found for {query}")
            return []
        
        # Score and process results
        scored_results = []
        
        for match in response['bestMatches']:
            symbol = match.get('1. symbol', '')
            name = match.get('2. name', '')
            match_type = match.get('3. type', 'Equity')
            region = match.get('4. region', 'United States')
            currency = match.get('8. currency', 'USD')
            
            # Skip if ticker is shorter than query
            if len(symbol) < len(query_upper):
                continue
            
            # Calculate relevance score
            score = calculate_relevance_score(
                symbol=symbol,
                name=name,
                query_upper=query_upper,
                query_lower=query_lower
            )
            
            if score > 0:
                result = {
                    'symbol': symbol,
                    'name': name,
                    'type': match_type,
                    'region': region,
                    'currency': currency,
                    'score': score,
                    'source': 'alpha_vantage'
                }
                scored_results.append(result)
        
        # Sort by score descending
        scored_results.sort(key=lambda x: x['score'], reverse=True)
        
        # Remove score from final results
        final_results = []
        for result in scored_results:
            result_copy = result.copy()
            del result_copy['score']
            final_results.append(result_copy)
        
        # Cache the results
        await client._save_to_cache(cache_key, final_results)
        
        logger.info(f"[vantage_api_search.py::vantage_api_symbol_search] Found {len(final_results)} results for {query}")
        
        return final_results[:limit]
        
    except Exception as e:
        DebugLogger.log_error(
            file_name="vantage_api_search.py",
            function_name="vantage_api_symbol_search",
            error=e,
            query=query
        )
        return []

def calculate_relevance_score(symbol: str, name: str, query_upper: str, query_lower: str) -> int:
    """Calculate relevance score for a symbol based on the query"""
    score = 0
    
    ticker_upper = symbol.upper()
    name_lower = name.lower()
    
    # Exact match of ticker (highest priority)
    if ticker_upper == query_upper:
        score += 100
        logger.debug(f"[vantage_api_search.py::calculate_relevance_score] Exact match: {symbol}")
    # Prefix match of ticker
    elif ticker_upper.startswith(query_upper):
        score += 75
        logger.debug(f"[vantage_api_search.py::calculate_relevance_score] Prefix match: {symbol}")
    # Substring match of ticker
    elif query_upper in ticker_upper:
        score += 50
        logger.debug(f"[vantage_api_search.py::calculate_relevance_score] Substring match: {symbol}")
    
    # Prefix match of company name
    if name_lower.startswith(query_lower):
        score += 60
    # Substring match of company name
    elif query_lower in name_lower:
        score += 40
    
    # Length penalty for very short tickers
    if len(ticker_upper) < 3:
        score -= 10
    
    # Levenshtein distance bonus (simple approximation)
    if len(ticker_upper) <= len(query_upper) + 2:
        common_prefix_len = 0
        for i in range(min(len(ticker_upper), len(query_upper))):
            if ticker_upper[i] == query_upper[i]:
                common_prefix_len += 1
            else:
                break
        
        if common_prefix_len >= len(query_upper) - 1:
            score += 10
    
    return score

# Also search from cached symbols in database
@DebugLogger.log_api_call(api_name="SUPABASE", sender="BACKEND", receiver="SUPA_API", operation="SYMBOL_SEARCH")
async def supa_api_search_cached_symbols(query: str, limit: int = 20) -> List[Dict[str, Any]]:
    """Search cached symbols from Supabase with scoring"""
    from supa_api.supa_api_client import get_supa_client
    
    logger.info(f"[vantage_api_search.py::supa_api_search_cached_symbols] Searching cached symbols for: {query}")
    
    if not query or len(query) < 1:
        return []
    
    query_upper = query.upper()
    query_lower = query.lower()
    
    try:
        client = get_supa_client()
        
        # Search for symbols that contain the query
        result = client.table('stock_symbols') \
            .select('*') \
            .or_(f'symbol.ilike.%{query}%,name.ilike.%{query}%') \
            .limit(100) \
            .execute()
        
        if not result.data:
            return []
        
        # Score the results
        scored_results = []
        for symbol_data in result.data:
            score = calculate_relevance_score(
                symbol=symbol_data['symbol'],
                name=symbol_data['name'],
                query_upper=query_upper,
                query_lower=query_lower
            )
            
            if score > 0:
                result_dict = {
                    'symbol': symbol_data['symbol'],
                    'name': symbol_data['name'],
                    'type': symbol_data.get('type', 'Equity'),
                    'region': 'United States',
                    'currency': symbol_data.get('currency', 'USD'),
                    'exchange': symbol_data.get('exchange', ''),
                    'score': score,
                    'source': 'cache'
                }
                scored_results.append(result_dict)
        
        # Sort by score
        scored_results.sort(key=lambda x: x['score'], reverse=True)
        
        # Remove scores
        final_results = []
        for result in scored_results:
            result_copy = result.copy()
            del result_copy['score']
            final_results.append(result_copy)
        
        return final_results[:limit]
        
    except Exception as e:
        logger.warning(f"[vantage_api_search.py::supa_api_search_cached_symbols] Cache search failed: {e}")
        return []

# Combined search function
async def combined_symbol_search(query: str, limit: int = 20) -> List[Dict[str, Any]]:
    """Search both cached and live symbols, merge and deduplicate"""
    logger.info(f"[vantage_api_search.py::combined_symbol_search] Combined search for: {query}")
    
    # Search both sources
    cached_results = await supa_api_search_cached_symbols(query, limit)
    vantage_results = await vantage_api_symbol_search(query, limit)
    
    # Merge and deduplicate
    seen_symbols = set()
    combined_results = []
    
    # Add cached results first (they're faster)
    for result in cached_results:
        if result['symbol'] not in seen_symbols:
            seen_symbols.add(result['symbol'])
            combined_results.append(result)
    
    # Add vantage results
    for result in vantage_results:
        if result['symbol'] not in seen_symbols:
            seen_symbols.add(result['symbol'])
            combined_results.append(result)
    
    logger.info(f"[vantage_api_search.py::combined_symbol_search] Combined results: {len(combined_results)}")
    
    return combined_results[:limit] 