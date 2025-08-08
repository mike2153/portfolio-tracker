'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { StockResearchData, NewsArticle } from '@/types/stock-research';
import { front_api_client } from '@/lib/front_api_client';
import { RefreshCw, ExternalLink, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface NewsTabProps {
  ticker: string;
  data: StockResearchData;
  isLoading: boolean;
  onRefresh: () => void;
}

const SENTIMENT_CONFIG = {
  'Bullish': { color: 'text-green-300', bg: 'bg-green-900/90', border: 'border-green-500', icon: TrendingUp },
  'Somewhat-Bullish': { color: 'text-emerald-300', bg: 'bg-emerald-900/90', border: 'border-emerald-500', icon: TrendingUp },
  'Neutral': { color: 'text-gray-300', bg: 'bg-gray-800/90', border: 'border-gray-500', icon: Minus },
  'Somewhat-Bearish': { color: 'text-amber-300', bg: 'bg-amber-900/90', border: 'border-amber-500', icon: TrendingDown },
  'Bearish': { color: 'text-red-300', bg: 'bg-red-900/90', border: 'border-red-500', icon: TrendingDown }
} as const;

const NewsCardSkeleton: React.FC = () => (
  <div className="animate-pulse bg-gray-800/50 backdrop-blur-sm rounded-xl overflow-hidden">
    <div className="bg-gray-700 h-48" />
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="h-4 bg-gray-700 rounded w-24" />
        <div className="h-4 bg-gray-700 rounded w-16" />
      </div>
      <div className="h-5 bg-gray-700 rounded w-3/4" />
      <div className="h-4 bg-gray-700 rounded w-full" />
      <div className="flex gap-2">
        <div className="h-6 bg-gray-700 rounded-full w-20" />
        <div className="h-6 bg-gray-700 rounded-full w-16" />
      </div>
    </div>
  </div>
);

// List of supported image domains from next.config.js
const SUPPORTED_IMAGE_DOMAINS = [
  'g.foolcdn.com',
  'cdn.finra.org',
  'seekingalpha.com',
  'static.seekingalpha.com',
  'assets.marketwatch.com',
  'cdn.marketaux.com',
  'cdn.benzinga.com',
  'www.benzinga.com',
  'staticx-tuner.zacks.com',
  'static.zacks.com',
  'images.unsplash.com',
  'via.placeholder.com',
  'assets.bwbx.io',
  'static01.nyt.com',
  'images.wsj.net',
  'thumbs.dreamstime.com',
  'cdn.cnn.com',
  'assets.cnbc.com',
  'image.cnbcfm.com',
  'media.cnn.com',
  'graphics.reuters.com',
];

// Fallback stock market image from Unsplash (already in supported domains)
const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80';

const isImageUrlSupported = (url: string | undefined): boolean => {
  if (!url) return false;
  try {
    const urlObj = new URL(url);
    return SUPPORTED_IMAGE_DOMAINS.includes(urlObj.hostname);
  } catch {
    return false;
  }
};

const formatTimeAgo = (dateString: string): string => {
  // Parse the date string in format YYYYMMDDTHHMMSS
  const year = parseInt(dateString.substring(0, 4));
  const month = parseInt(dateString.substring(4, 6)) - 1; // JS months are 0-indexed
  const day = parseInt(dateString.substring(6, 8));
  const hour = parseInt(dateString.substring(9, 11));
  const minute = parseInt(dateString.substring(11, 13));
  const second = parseInt(dateString.substring(13, 15));
  
  const date = new Date(year, month, day, hour, minute, second);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 604800)}w ago`;
  if (seconds < 31536000) return `${Math.floor(seconds / 2592000)}mo ago`;
  return `${Math.floor(seconds / 31536000)}y ago`;
};

const NewsCard: React.FC<{ article: NewsArticle }> = ({ article }) => {
  const [imageError, setImageError] = useState(false);
  const sentiment = SENTIMENT_CONFIG[article.overall_sentiment_label as keyof typeof SENTIMENT_CONFIG] || SENTIMENT_CONFIG.Neutral;
  const SentimentIcon = sentiment.icon;
  const _sentimentScore = Math.round(article.overall_sentiment_score * 100);
  
  // Determine the image URL to use
  const imageUrl = (() => {
    if (imageError) return FALLBACK_IMAGE;
    if (!article.banner_image) return FALLBACK_IMAGE;
    // Use fallback if the domain is not supported
    return isImageUrlSupported(article.banner_image) ? article.banner_image : FALLBACK_IMAGE;
  })();
  
  const showImage = imageUrl !== null;
  
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block bg-gray-800/50 backdrop-blur-sm rounded-xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-black/20"
    >
      {/* Image Container */}
      <div className="relative h-48 overflow-hidden bg-gray-900">
        {showImage ? (
          <Image
            src={imageUrl}
            alt={article.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-110"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
            <div className="text-gray-600 text-4xl font-bold">
              {article.source.charAt(0).toUpperCase()}
            </div>
          </div>
        )}
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent opacity-60" />
        
        {/* Sentiment Badge */}
        <div className={`absolute top-4 right-4 px-3 py-1.5 rounded-full ${sentiment.bg} ${sentiment.border} border-2 flex items-center gap-1.5 shadow-lg`}>
          <SentimentIcon size={14} className={sentiment.color} />
          <span className={`text-xs font-semibold ${sentiment.color}`}>{article.overall_sentiment_label}</span>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Source and Time */}
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="font-medium">{article.source}</span>
          <span>•</span>
          <span>{formatTimeAgo(article.time_published)}</span>
        </div>
        
        {/* Title */}
        <h3 className="text-base font-semibold text-gray-100 line-clamp-2 group-hover:text-blue-400 transition-colors">
          {article.title}
        </h3>
        
        {/* Summary */}
        {article.summary && (
          <p className="text-sm text-gray-400 line-clamp-2">
            {article.summary}
          </p>
        )}
        
        {/* Footer */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex gap-1">
            {article.topics.slice(0, 2).map((topic, idx) => (
              <span key={idx} className="text-xs px-2 py-1 bg-gray-700/50 rounded-full text-gray-300">
                {topic.topic}
              </span>
            ))}
          </div>
          <ExternalLink size={14} className="text-gray-500 group-hover:text-blue-400 transition-colors" />
        </div>
      </div>
    </a>
  );
};

const NewsTab: React.FC<NewsTabProps> = ({ ticker, data, isLoading, onRefresh }) => {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [fetchingNews, setFetchingNews] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'relevance' | 'latest'>('relevance');
  
  console.log('[NewsTab] Component rendered with:', { ticker, hasData: !!data, isLoading });
  
  const fetchNews = useCallback(async () => {
    console.log('[NewsTab] fetchNews called for ticker:', ticker);
    setFetchingNews(true);
    setError(null);
    
    try {
      const url = `/api/news/${ticker}?limit=30`;
      console.log('[NewsTab] Fetching news from:', url);
      const response = await front_api_client.get(url);
      console.log('[NewsTab] Response received:', response);
      
      if (response.success && response.data) {
        console.log('[NewsTab] Articles found:', response.data.articles?.length || 0);
        setNews(response.data.articles || []);
      } else {
        console.error('[NewsTab] API error:', response.error);
        setError(response.error || 'Failed to fetch news');
      }
    } catch (err) {
      console.error('[NewsTab] Fetch error:', err);
      setError('Failed to fetch news');
    } finally {
      setFetchingNews(false);
    }
  }, [ticker]);
  
  useEffect(() => {
    console.log('[NewsTab] Component mounted/ticker changed:', ticker);
    if (ticker) {
      fetchNews();
    }
  }, [ticker, fetchNews]);
  
  const loading = isLoading || fetchingNews;
  
  // Sort articles based on selected sort option
  const sortedNews = [...news].sort((a, b) => {
    if (sortBy === 'relevance') {
      const aRelevance = parseFloat(a.ticker_sentiment?.relevance_score || '0');
      const bRelevance = parseFloat(b.ticker_sentiment?.relevance_score || '0');
      return bRelevance - aRelevance;
    } else {
      // Sort by latest (already sorted by API, but we could parse dates if needed)
      return 0;
    }
  });
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-white">Latest News & Sentiment</h3>
          <p className="text-sm text-gray-400 mt-1">
            Real-time news with AI-powered sentiment analysis
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Sort Toggle */}
          <div className="flex items-center gap-2 bg-gray-800 rounded-lg p-1">
            <span className="text-xs text-gray-400 px-2">Sort by:</span>
            <button
              onClick={() => setSortBy('relevance')}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                sortBy === 'relevance' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Relevance
            </button>
            <button
              onClick={() => setSortBy('latest')}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                sortBy === 'latest' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Latest
            </button>
          </div>
          {/* Refresh Button */}
          <button
            onClick={() => {
              onRefresh();
              fetchNews();
            }}
            disabled={loading}
            className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>
      
      {/* Error State */}
      {error && (
        <div className="rounded-xl bg-red-900/20 border border-red-900/50 p-4">
          <p className="text-red-400">{error}</p>
        </div>
      )}
      
      {/* News Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array(6).fill(0).map((_, i) => <NewsCardSkeleton key={i} />)
        ) : sortedNews.length > 0 ? (
          sortedNews.map((article, index) => <NewsCard key={`${article.url}-${index}`} article={article} />)
        ) : !error && (
          <div className="col-span-full text-center py-12">
            <p className="text-gray-400">No news articles available</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NewsTab;
