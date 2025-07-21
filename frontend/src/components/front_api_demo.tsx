/**
 * Demonstration component showing front_api_client in action
 * Shows the extensive logging and proper error handling
 */
'use client';

import React, { useState } from 'react';
import { 
  front_api_get_dashboard,
  front_api_search_symbols,
  front_api_get_stock_overview,
  front_api_validate_auth_token,
  front_api_health_check
} from '@portfolio-tracker/shared';

export default function FrontApiDemo() {
  const [results, setResults] = useState<any>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const runApiTest = async (testName: string, apiFunction: () => Promise<any>) => {
    // Commenting out verbose logs
    // console.log(`[FrontApiDemo] Starting ${testName} test...`);
    setLoading(prev => ({ ...prev, [testName]: true }));
    
    try {
      const result = await apiFunction();
      setResults(prev => ({ ...prev, [testName]: result }));
      // Commenting out verbose logs
      // console.log(`[FrontApiDemo] ✅ ${testName} completed successfully:`, result);
    } catch (error) {
      // Commenting out verbose logs
      // console.error(`[FrontApiDemo] ❌ ${testName} failed:`, error);
      setResults(prev => ({ ...prev, [testName]: { error: error.message } }));
    } finally {
      setLoading(prev => ({ ...prev, [testName]: false }));
    }
  };

  const testFunctions = [
    {
      name: 'Health Check',
      key: 'health',
      fn: () => front_api_health_check()
    },
    {
      name: 'Auth Validation',
      key: 'auth',
      fn: () => front_api_validate_auth_token()
    },
    {
      name: 'Dashboard Data',
      key: 'dashboard',
      fn: () => front_api_get_dashboard()
    },
    {
      name: 'Symbol Search',
      key: 'search',
      fn: () => front_api_search_symbols({ query: 'AAPL', limit: 5 })
    },
    {
      name: 'Stock Overview',
      key: 'overview',
      fn: () => front_api_get_stock_overview('AAPL')
    }
  ];

  return (
    <div className="p-6 bg-gray-900 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-6">🚀 Front API Client Demo</h1>
      <p className="mb-6 text-gray-300">
        This demonstrates the centralized front_api_* functions with extensive logging.
        Check your browser console to see the detailed API logs.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {testFunctions.map(({ name, key, fn }) => (
          <button
            key={key}
            onClick={() => runApiTest(key, fn)}
            disabled={loading[key]}
            className="p-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg transition-colors"
          >
            {loading[key] ? '⏳ Loading...' : `Test ${name}`}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold">API Results:</h2>
        {Object.entries(results).map(([key, result]) => (
          <div key={key} className="bg-gray-800 p-4 rounded-lg">
            <h3 className="font-bold mb-2">{key.toUpperCase()}</h3>
            <pre className="text-sm text-gray-300 overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        ))}
      </div>

      <div className="mt-8 p-4 bg-green-900 rounded-lg">
        <h3 className="font-bold text-green-400 mb-2">✅ Implementation Features:</h3>
        <ul className="text-green-300 space-y-1">
          <li>• All functions use front_api_* naming convention</li>
          <li>• Extensive logging with file/function/API/sender/receiver info</li>
          <li>• Real Supabase authentication (no mocks)</li>
          <li>• Snake_case naming throughout</li>
          <li>• Comprehensive error handling</li>
          <li>• TypeScript types for all responses</li>
          <li>• Centralized single source of truth</li>
        </ul>
      </div>
    </div>
  );
} 