import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import moment from 'moment';

interface TestUser {
  id: string;
  email: string;
  access_token: string;
}

interface TestTransaction {
  transaction_type: 'BUY' | 'SELL' | 'DIVIDEND';
  ticker: string;
  company_name: string;
  shares: number;
  price_per_share: number;
  transaction_date: string;
  transaction_currency: string;
  commission: number;
  notes: string;
}

interface SeedingConfig {
  userId: string;
  portfolioSize: number; // Total investment amount
  transactionCount: number;
  tickers: string[];
  timespan: number; // Days of history
  includeDividends: boolean;
}

export class TestDataSeeder {
  private supabase: any;
  private apiBaseUrl: string;
  private alphaVantageKey: string;

  constructor() {
    this.supabase = createClient(
      process.env.TEST_SUPABASE_URL!,
      process.env.TEST_SUPABASE_SERVICE_ROLE_KEY!
    );
    this.apiBaseUrl = process.env.TEST_BACKEND_URL || 'http://localhost:8000';
    this.alphaVantageKey = process.env.TEST_ALPHA_VANTAGE_API_KEY || '';
  }

  /**
   * Create a realistic test user with authentication
   */
  async createTestUser(): Promise<TestUser> {
    console.log('🧪 Creating test user...');
    
    const email = process.env.TEST_USER_EMAIL || `test.${Date.now()}@example.com`;
    const password = process.env.TEST_USER_PASSWORD || 'test_password_123';

    try {
      // Try to sign in first (user might already exist)
      console.log(`🔐 Attempting to sign in with existing user: ${email}`);
      
      const { data: signInData, error: signInError } = await this.supabase.auth.signInWithPassword({
        email,
        password
      });

      if (signInData?.user && signInData?.session) {
        // User exists and signed in successfully
        const testUser: TestUser = {
          id: signInData.user.id,
          email: email,
          access_token: signInData.session.access_token
        };

        console.log(`✅ Test user signed in: ${testUser.email} (ID: ${testUser.id})`);
        return testUser;
      }

      // If sign in failed, try to create new user
      console.log(`👤 User doesn't exist, creating new user: ${email}`);
      
      const { data, error } = await this.supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          first_name: process.env.TEST_USER_FIRST_NAME || 'Test',
          last_name: process.env.TEST_USER_LAST_NAME || 'User',
          created_for_testing: true,
          created_at: new Date().toISOString()
        }
      });

      if (error) {
        throw new Error(`Failed to create test user: ${error.message}`);
      }

      // Sign in to get access token
      const { data: newSignInData, error: newSignInError } = await this.supabase.auth.signInWithPassword({
        email,
        password
      });

      if (newSignInError) {
        throw new Error(`Failed to sign in new test user: ${newSignInError.message}`);
      }

      const testUser: TestUser = {
        id: data.user.id,
        email: email,
        access_token: newSignInData.session.access_token
      };

      console.log(`✅ Test user created: ${testUser.email} (ID: ${testUser.id})`);
      return testUser;

    } catch (error) {
      console.error('❌ Failed to create/sign in test user:', error);
      throw error;
    }
  }

  /**
   * Get historical stock prices for realistic transaction pricing
   */
  async getHistoricalPrices(ticker: string, days: number = 365): Promise<any[]> {
    if (this.alphaVantageKey === 'demo') {
      // Return mock data for demo key
      return this.generateMockPrices(ticker, days);
    }

    try {
      console.log(`📊 Fetching historical prices for ${ticker}...`);
      
      // Add delay to respect API rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));

      const response = await axios.get(`https://www.alphavantage.co/query`, {
        params: {
          function: 'TIME_SERIES_DAILY',
          symbol: ticker,
          apikey: this.alphaVantageKey,
          outputsize: 'full'
        },
        timeout: 10000
      });

      if (response.data['Error Message']) {
        console.warn(`⚠️ API error for ${ticker}, using mock data`);
        return this.generateMockPrices(ticker, days);
      }

      const timeSeries = response.data['Time Series (Daily)'];
      if (!timeSeries) {
        console.warn(`⚠️ No data for ${ticker}, using mock data`);
        return this.generateMockPrices(ticker, days);
      }

      // Convert to our format
      const prices = Object.entries(timeSeries)
        .map(([date, data]: [string, any]) => ({
          date,
          close: parseFloat(data['4. close']),
          high: parseFloat(data['2. high']),
          low: parseFloat(data['3. low']),
          volume: parseInt(data['5. volume'])
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(-days);

      console.log(`✅ Got ${prices.length} price points for ${ticker}`);
      return prices;

    } catch (error) {
      console.warn(`⚠️ Error fetching ${ticker} prices, using mock data:`, error.message);
      return this.generateMockPrices(ticker, days);
    }
  }

  /**
   * Generate mock historical prices for testing
   */
  private generateMockPrices(ticker: string, days: number): any[] {
    const prices = [];
    let basePrice = this.getBaseMockPrice(ticker);
    
    for (let i = 0; i < days; i++) {
      const date = moment().subtract(days - i, 'days').format('YYYY-MM-DD');
      
      // Random walk with slight upward bias
      const change = (Math.random() - 0.45) * 0.05; // Slight upward bias
      basePrice *= (1 + change);
      
      prices.push({
        date,
        close: Math.round(basePrice * 100) / 100,
        high: Math.round(basePrice * 1.02 * 100) / 100,
        low: Math.round(basePrice * 0.98 * 100) / 100,
        volume: Math.floor(Math.random() * 10000000)
      });
    }

    return prices;
  }

  /**
   * Get base price for mock data generation
   */
  private getBaseMockPrice(ticker: string): number {
    const mockPrices: { [key: string]: number } = {
      'AAPL': 150,
      'MSFT': 250,
      'GOOGL': 2500,
      'TSLA': 800,
      'NVDA': 400,
      'AMZN': 3000,
      'META': 300,
      'NFLX': 400
    };
    
    return mockPrices[ticker] || 100 + Math.random() * 200;
  }

  /**
   * Create realistic transaction history
   */
  async seedTransactionData(config: SeedingConfig): Promise<TestTransaction[]> {
    console.log(`🌱 Seeding transaction data for user ${config.userId}...`);
    console.log(`📊 Config:`, config);

    const transactions: TestTransaction[] = [];
    
    // Get historical prices for all tickers
    const priceData: { [ticker: string]: any[] } = {};
    for (const ticker of config.tickers) {
      priceData[ticker] = await this.getHistoricalPrices(ticker, config.timespan);
    }

    // Calculate investment per ticker
    const investmentPerTicker = config.portfolioSize / config.tickers.length;
    const transactionsPerTicker = Math.floor(config.transactionCount / config.tickers.length);

    for (const ticker of config.tickers) {
      const prices = priceData[ticker];
      let remainingShares = 0;
      let investmentRemaining = investmentPerTicker;

      for (let i = 0; i < transactionsPerTicker && investmentRemaining > 0; i++) {
        // Random date within timespan
        const dayIndex = Math.floor(Math.random() * (prices.length - 30)); // Leave some recent days
        const pricePoint = prices[dayIndex];
        
        if (!pricePoint) continue;

        const transactionType: 'BUY' | 'SELL' = 
          remainingShares === 0 ? 'BUY' : 
          Math.random() < 0.8 ? 'BUY' : 'SELL'; // 80% buy, 20% sell

        let shares: number;
        let price: number = pricePoint.close;

        if (transactionType === 'BUY') {
          // Buy between 10-50% of remaining investment
          const maxInvestment = investmentRemaining * (0.1 + Math.random() * 0.4);
          shares = Math.floor(maxInvestment / price);
          
          if (shares > 0) {
            remainingShares += shares;
            investmentRemaining -= shares * price;
          } else {
            continue; // Skip if can't afford even 1 share
          }
        } else {
          // Sell 10-50% of current shares
          shares = Math.floor(remainingShares * (0.1 + Math.random() * 0.4));
          remainingShares -= shares;
          
          if (shares <= 0) continue;
        }

        const transaction: TestTransaction = {
          transaction_type: transactionType,
          ticker: ticker,
          company_name: this.getCompanyName(ticker),
          shares: shares,
          price_per_share: price,
          transaction_date: pricePoint.date,
          transaction_currency: 'USD',
          commission: Math.round((2 + Math.random() * 8) * 100) / 100, // $2-10 commission
          notes: `Test transaction for ${ticker} - ${transactionType}`
        };

        transactions.push(transaction);
      }

      // Add dividend transactions if enabled
      if (config.includeDividends && remainingShares > 0) {
        const dividendTransactions = this.generateDividendTransactions(
          ticker, 
          remainingShares, 
          prices.slice(-90) // Last 90 days
        );
        transactions.push(...dividendTransactions);
      }
    }

    // Sort transactions by date
    transactions.sort((a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime());

    console.log(`✅ Generated ${transactions.length} transactions`);
    
    // Send transactions to backend
    await this.submitTransactions(config.userId, transactions);
    
    return transactions;
  }

  /**
   * Generate dividend transactions
   */
  private generateDividendTransactions(ticker: string, shares: number, recentPrices: any[]): TestTransaction[] {
    const dividends: TestTransaction[] = [];
    
    // Quarterly dividends for the last year
    const quarterlyDividend = this.getQuarterlyDividend(ticker);
    
    if (quarterlyDividend === 0) return dividends;

    for (let quarter = 0; quarter < 4; quarter++) {
      const dayIndex = Math.floor(quarter * (recentPrices.length / 4));
      const pricePoint = recentPrices[dayIndex];
      
      if (!pricePoint) continue;

      dividends.push({
        transaction_type: 'DIVIDEND',
        ticker: ticker,
        company_name: this.getCompanyName(ticker),
        shares: shares,
        price_per_share: quarterlyDividend,
        transaction_date: pricePoint.date,
        transaction_currency: 'USD',
        commission: 0,
        notes: `Quarterly dividend payment for ${ticker}`
      });
    }

    return dividends;
  }

  /**
   * Get realistic quarterly dividend for ticker
   */
  private getQuarterlyDividend(ticker: string): number {
    const dividends: { [key: string]: number } = {
      'AAPL': 0.25,
      'MSFT': 0.75,
      'GOOGL': 0.0, // No dividend
      'TSLA': 0.0, // No dividend
      'NVDA': 0.20,
      'AMZN': 0.0, // No dividend
      'META': 0.0, // No dividend
      'NFLX': 0.0  // No dividend
    };
    
    return dividends[ticker] || 0;
  }

  /**
   * Get company name for ticker
   */
  private getCompanyName(ticker: string): string {
    const companies: { [key: string]: string } = {
      'AAPL': 'Apple Inc.',
      'MSFT': 'Microsoft Corporation',
      'GOOGL': 'Alphabet Inc.',
      'TSLA': 'Tesla, Inc.',
      'NVDA': 'NVIDIA Corporation',
      'AMZN': 'Amazon.com, Inc.',
      'META': 'Meta Platforms, Inc.',
      'NFLX': 'Netflix, Inc.'
    };
    
    return companies[ticker] || `${ticker} Corporation`;
  }

  /**
   * Submit transactions to backend API
   */
  private async submitTransactions(userId: string, transactions: TestTransaction[]): Promise<void> {
    console.log(`📤 Submitting ${transactions.length} transactions to backend...`);

    for (const transaction of transactions) {
      try {
        const response = await axios.post(`${this.apiBaseUrl}/api/transactions/create`, {
          ...transaction,
          user_id: userId
        }, {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000
        });

        if (!response.data.ok) {
          console.warn(`⚠️ Failed to create transaction:`, response.data);
        }

        // Add delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`❌ Error submitting transaction:`, error.message);
      }
    }

    console.log(`✅ Finished submitting transactions`);
  }

  /**
   * Clean up test data
   */
  async cleanupTestUser(userId: string): Promise<void> {
    console.log(`🧹 Cleaning up test data for user ${userId}...`);

    try {
      // Delete user from Supabase (this should cascade delete related data)
      const { error } = await this.supabase.auth.admin.deleteUser(userId);
      
      if (error) {
        console.warn(`⚠️ Failed to delete test user: ${error.message}`);
      } else {
        console.log(`✅ Test user ${userId} deleted`);
      }

    } catch (error) {
      console.error('❌ Error during cleanup:', error);
    }
  }
}

export default TestDataSeeder; 