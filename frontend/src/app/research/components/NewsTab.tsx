'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, ExternalLink, Clock, User, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { TabContentProps, NewsArticle } from '@/types/stock-research';

export default function NewsTab({ ticker, data, isLoading, onRefresh }: TabContentProps) {
  const [newsData, setNewsData] = useState<NewsArticle[]>(data.news || []);
  const [loadingNews, setLoadingNews] = useState(false);
  const [selectedSentiment, setSelectedSentiment] = useState<string>('All');

  useEffect(() => {
    if (data.news) {
      setNewsData(data.news);
    } else {
      loadNewsData();
    }
  }, [ticker, data.news]);

  const loadNewsData = async () => {
    setLoadingNews(true);
    try {
      const news = await stockResearchAPI.getNews(ticker);
      setNewsData(news);
    } catch (error) {
      console.error('Error loading news data:', error);
    } finally {
      setLoadingNews(false);
    }
  };

  const formatTimeAgo = (timeString: string) => {
    try {
      // Alpha Vantage format: YYYYMMDDTHHMMSS
      const year = timeString.slice(0, 4);
      const month = timeString.slice(4, 6);
      const day = timeString.slice(6, 8);
      const hour = timeString.slice(9, 11);
      const minute = timeString.slice(11, 13);
      
      const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:00Z`);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);

      if (diffDays > 7) {
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      } else if (diffDays > 0) {
        return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
      } else if (diffHours > 0) {
        return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
      } else {
        return 'Just now';
      }
    } catch {
      return timeString;
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment.toLowerCase()) {
      case 'bullish':
        return <TrendingUp size={14} className="text-green-400" />;
      case 'bearish':
        return <TrendingDown size={14} className="text-red-400" />;
      default:
        return <Minus size={14} className="text-gray-400" />;
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment.toLowerCase()) {
      case 'bullish':
        return 'bg-green-900/30 text-green-400 border-green-400';
      case 'bearish':
        return 'bg-red-900/30 text-red-400 border-red-400';
      default:
        return 'bg-gray-800 text-gray-400 border-gray-400';
    }
  };

  const sentimentOptions = ['All', 'Bullish', 'Neutral', 'Bearish'];
  const filteredNews = selectedSentiment === 'All' 
    ? newsData 
    : newsData.filter(article => article.sentiment === selectedSentiment);

  if (loadingNews || isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex items-center gap-2 text-gray-400">
          <RefreshCw className="w-5 h-5 animate-spin" />
          Loading news...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-xl font-bold text-white">News & Sentiment</h2>
        <button
          onClick={() => {
            onRefresh();
            loadNewsData();
          }}
          disabled={isLoading || loadingNews}
          className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${(isLoading || loadingNews) ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Sentiment Filter */}
      <div className="flex items-center gap-2 overflow-x-auto">
        <span className="text-sm text-gray-400 whitespace-nowrap">Filter by sentiment:</span>
        <div className="flex gap-2">
          {sentimentOptions.map(sentiment => (
            <button
              key={sentiment}
              onClick={() => setSelectedSentiment(sentiment)}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors whitespace-nowrap ${
                selectedSentiment === sentiment
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {sentiment}
            </button>
          ))}
        </div>
      </div>

      {/* News Articles */}
      {filteredNews.length === 0 ? (
        <div className="text-center py-16">
          <ExternalLink size={48} className="mx-auto mb-4 text-gray-600" />
          <h3 className="text-lg font-medium text-gray-400 mb-2">No News Available</h3>
          <p className="text-gray-500">
            No recent news articles found for {ticker}
            {selectedSentiment !== 'All' && ` with ${selectedSentiment.toLowerCase()} sentiment`}.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredNews.map((article, index) => (
            <div key={index} className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-colors">
              {/* Article Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-2 line-clamp-2">
                    {article.title}
                  </h3>
                  <div className="flex items-center gap-3 text-sm text-gray-400 mb-2">
                    <div className="flex items-center gap-1">
                      <User size={12} />
                      <span>{article.source}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock size={12} />
                      <span>{formatTimeAgo(article.time_published)}</span>
                    </div>
                    {article.authors.length > 0 && (
                      <span>by {article.authors.slice(0, 2).join(', ')}</span>
                    )}
                  </div>
                </div>
                
                {/* Sentiment Badge */}
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-medium ${
                  getSentimentColor(article.sentiment)
                }`}>
                  {getSentimentIcon(article.sentiment)}
                  {article.sentiment}
                </div>
              </div>

              {/* Article Summary */}
              <p className="text-gray-300 text-sm leading-relaxed mb-4 line-clamp-3">
                {article.summary}
              </p>

              {/* Topics */}
              {article.topics && article.topics.length > 0 && (
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs text-gray-400">Topics:</span>
                  <div className="flex flex-wrap gap-1">
                    {article.topics.slice(0, 3).map((topic, topicIndex) => (
                      <span 
                        key={topicIndex}
                        className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded"
                      >
                        {topic.topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Article Footer */}
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-400">
                  Sentiment Score: {article.sentiment_score?.toFixed(3) || 'N/A'}
                </div>
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-colors"
                >
                  Read Full Article
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary Stats */}
      {newsData.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-3">News Summary</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-xl font-bold text-white">
                {newsData.length}
              </div>
              <div className="text-sm text-gray-400">Total Articles</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-green-400">
                {newsData.filter(a => a.sentiment === 'Bullish').length}
              </div>
              <div className="text-sm text-gray-400">Bullish</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-gray-400">
                {newsData.filter(a => a.sentiment === 'Neutral').length}
              </div>
              <div className="text-sm text-gray-400">Neutral</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-red-400">
                {newsData.filter(a => a.sentiment === 'Bearish').length}
              </div>
              <div className="text-sm text-gray-400">Bearish</div>
            </div>
          </div>
        </div>
      )}

      {/* Data Attribution */}
      <div className="text-center text-xs text-gray-500">
        News and sentiment data provided by Alpha Vantage • Sentiment analysis is automated and may not reflect human judgment
      </div>
    </div>
  );
}