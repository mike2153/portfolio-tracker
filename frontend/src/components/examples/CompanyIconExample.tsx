'use client';

import CompanyIcon from '@/components/ui/CompanyIcon';

const CompanyIconExample = () => {
  // Example symbols from different categories
  const testSymbols = [
    'AAPL',    // Stock (should have icon)
    'BTC',     // Crypto (should have icon)
    'USD',     // Forex (should have icon)
    'FAKE',    // Non-existent (should show fallback)
    'GOOGL',   // Stock (should have icon)
    'ETH',     // Crypto (should have icon)
  ];

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold mb-4">Company Icon Examples</h2>
      
      {/* Different sizes */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Different Sizes</h3>
        <div className="flex items-center gap-4">
          <CompanyIcon symbol="AAPL" size={16} />
          <CompanyIcon symbol="AAPL" size={24} />
          <CompanyIcon symbol="AAPL" size={32} />
          <CompanyIcon symbol="AAPL" size={48} />
          <CompanyIcon symbol="AAPL" size={64} />
        </div>
      </div>

      {/* Different symbols */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Different Symbols</h3>
        <div className="grid grid-cols-3 gap-4">
          {testSymbols.map((symbol) => (
            <div key={symbol} className="flex items-center gap-2">
              <CompanyIcon symbol={symbol} size={32} />
              <span className="font-medium">{symbol}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Different fallback types */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Fallback Types (using FAKE symbol)</h3>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <CompanyIcon symbol="FAKE" size={32} fallback="initials" />
            <span>Initials</span>
          </div>
          <div className="flex items-center gap-2">
            <CompanyIcon symbol="FAKE" size={32} fallback="placeholder" />
            <span>Placeholder</span>
          </div>
          <div className="flex items-center gap-2">
            <CompanyIcon symbol="FAKE" size={32} fallback="none" />
            <span>None (empty)</span>
          </div>
        </div>
      </div>

      {/* In context example */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">In Context (Portfolio-like)</h3>
        <div className="bg-white rounded-lg border p-4">
          <div className="space-y-3">
            {[
              { symbol: 'AAPL', name: 'Apple Inc.', shares: 10, value: '$1,500' },
              { symbol: 'BTC', name: 'Bitcoin', shares: 0.25, value: '$12,000' },
              { symbol: 'GOOGL', name: 'Alphabet Inc.', shares: 5, value: '$750' },
              { symbol: 'ETH', name: 'Ethereum', shares: 3.5, value: '$8,500' },
            ].map((holding) => (
              <div key={holding.symbol} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                <div className="flex items-center gap-3">
                  <CompanyIcon symbol={holding.symbol} size={28} />
                  <div>
                    <div className="font-medium">{holding.symbol}</div>
                    <div className="text-sm text-gray-600">{holding.name}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium">{holding.value}</div>
                  <div className="text-sm text-gray-600">{holding.shares} shares</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompanyIconExample;