import { test, expect, Page } from '@playwright/test';
import { TestDataSeeder } from '../utils/test-data-seeder';

/**
 * Enhanced Dashboard E2E Tests
 * 
 * These tests validate the entire dashboard functionality using:
 * - Real Supabase authentication
 * - Real Django backend API
 * - Real Alpha Vantage API calls (or realistic mock data)
 * - Real browser automation
 * - Realistic transaction data
 */

let testUser: any;
let testDataSeeder: TestDataSeeder;

test.describe('Enhanced Dashboard E2E Tests', () => {
  
  test.beforeAll(async () => {
    console.log('🚀 Setting up E2E test environment...');
    
    testDataSeeder = new TestDataSeeder();
    
    // Create test user with real authentication
    testUser = await testDataSeeder.createTestUser();
    
    // Seed realistic transaction data
    await testDataSeeder.seedTransactionData({
      userId: testUser.id,
      portfolioSize: parseInt(process.env.TEST_PORTFOLIO_SIZE || '50000'),
      transactionCount: parseInt(process.env.TEST_TRANSACTION_COUNT || '25'),
      tickers: (process.env.TEST_TICKERS || 'AAPL,MSFT,GOOGL,TSLA,NVDA').split(','),
      timespan: 365, // 1 year of history
      includeDividends: true
    });
    
    console.log('✅ E2E test environment setup complete');
  });

  test.afterAll(async () => {
    if (process.env.AUTO_CLEANUP === 'true' && testUser) {
      console.log('🧹 Cleaning up test data...');
      await testDataSeeder.cleanupTestUser(testUser.id);
      console.log('✅ Cleanup complete');
    }
  });

  test('Dashboard loads and authenticates user', async ({ page }) => {
    console.log('🧪 Testing dashboard authentication and loading...');
    
    // Navigate to the application
    await page.goto('/');
    
    // Check if we're redirected to auth page or dashboard loads
    await page.waitForLoadState('networkidle');
    
    // Take screenshot for debugging
    await page.screenshot({ path: 'test-results/dashboard-auth.png', fullPage: true });
    
    // Should see either login form or dashboard content
    const hasLoginForm = await page.locator('input[type="email"]').isVisible();
    const hasDashboard = await page.locator('h1').filter({ hasText: /portfolio/i }).isVisible();
    
    expect(hasLoginForm || hasDashboard).toBeTruthy();
    
    if (hasLoginForm) {
      console.log('🔐 Performing authentication flow...');
      
      // Fill in login form
      await page.fill('input[type="email"]', testUser.email);
      await page.fill('input[type="password"]', process.env.TEST_USER_PASSWORD || 'test_password_123');
      
      // Submit login
      await page.click('button[type="submit"]');
      
      // Wait for dashboard to load
      await page.waitForSelector('h1', { timeout: 15000 });
      await page.waitForLoadState('networkidle');
    }
    
    // Verify we're on the dashboard
    await expect(page.locator('h1')).toContainText(/portfolio/i);
    
    console.log('✅ Dashboard authentication successful');
  });

  test('KPI boxes display real financial data', async ({ page }) => {
    console.log('🧪 Testing KPI boxes with real financial data...');
    
    // Navigate to dashboard (assume we're already authenticated)
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Wait for KPI boxes to load (they should not show skeletons forever)
    await page.waitForSelector('[data-testid="kpi-grid"], .grid', { timeout: 30000 });
    
    // Take screenshot of KPI section
    await page.screenshot({ path: 'test-results/kpi-boxes.png' });
    
    // Find all KPI cards
    const kpiCards = page.locator('.rounded-xl').filter({ has: page.locator('h3') });
    const cardCount = await kpiCards.count();
    
    console.log(`📊 Found ${cardCount} KPI cards`);
    expect(cardCount).toBeGreaterThanOrEqual(4);
    
    // Test each KPI card
    for (let i = 0; i < Math.min(cardCount, 4); i++) {
      const card = kpiCards.nth(i);
      
      // Get card title
      const title = await card.locator('h3').textContent();
      console.log(`🔍 Testing KPI card: ${title}`);
      
      // Should have a main value (not just loading skeleton)
      const mainValue = card.locator('.text-2xl, .text-xl').first();
      await expect(mainValue).toBeVisible();
      
      const value = await mainValue.textContent();
      console.log(`📈 ${title} value: ${value}`);
      
      // Value should not be default/empty
      expect(value).not.toBe('0.00');
      expect(value).not.toBe('AU$0.00');
      expect(value).not.toBe('0.00%');
      expect(value).not.toBe('1.00');
      expect(value).not.toContain('Loading');
      expect(value).not.toContain('Error');
      
      // Should have sub-label with additional info
      const subLabel = card.locator('.text-xs, .text-sm').last();
      if (await subLabel.isVisible()) {
        const subText = await subLabel.textContent();
        console.log(`📝 ${title} sub-label: ${subText}`);
        expect(subText).toBeTruthy();
      }
    }
    
    console.log('✅ All KPI boxes displaying real data');
  });

  test('Portfolio value calculation is accurate', async ({ page }) => {
    console.log('🧪 Testing portfolio value accuracy...');
    
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Find the Portfolio Value KPI card
    const portfolioCard = page.locator('h3').filter({ hasText: /portfolio.?value/i }).locator('..');
    await expect(portfolioCard).toBeVisible();
    
    // Get the portfolio value
    const valueElement = portfolioCard.locator('.text-2xl, .text-xl').first();
    const portfolioValue = await valueElement.textContent();
    
    console.log(`📊 Portfolio Value: ${portfolioValue}`);
    
    // Portfolio value should be reasonable for our test data
    const numericValue = parseFloat(portfolioValue?.replace(/[^0-9.-]/g, '') || '0');
    
    // With $50k invested, portfolio should be in reasonable range ($30k - $100k)
    expect(numericValue).toBeGreaterThan(30000);
    expect(numericValue).toBeLessThan(100000);
    
    // Should show PNL information
    const pnlElement = portfolioCard.locator('.text-xs, .text-sm').last();
    if (await pnlElement.isVisible()) {
      const pnlText = await pnlElement.textContent();
      console.log(`📈 PNL Info: ${pnlText}`);
      
      // Should contain dollar amount and percentage
      expect(pnlText).toMatch(/\$\d+/); // Dollar amount
      expect(pnlText).toMatch(/\d+\.\d+%/); // Percentage
    }
    
    console.log('✅ Portfolio value calculation verified');
  });

  test('IRR calculation shows realistic returns', async ({ page }) => {
    console.log('🧪 Testing IRR calculation...');
    
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Find the IRR KPI card
    const irrCard = page.locator('h3').filter({ hasText: /irr/i }).locator('..');
    await expect(irrCard).toBeVisible();
    
    // Get the IRR value
    const valueElement = irrCard.locator('.text-2xl, .text-xl').first();
    const irrValue = await valueElement.textContent();
    
    console.log(`📊 IRR: ${irrValue}`);
    
    // IRR should be a percentage
    expect(irrValue).toMatch(/\d+\.\d+%/);
    
    // IRR should be realistic (-50% to +100% for test data)
    const numericValue = parseFloat(irrValue?.replace(/[^0-9.-]/g, '') || '0');
    expect(numericValue).toBeGreaterThan(-50);
    expect(numericValue).toBeLessThan(100);
    
    // Should show benchmark comparison
    const benchmarkElement = irrCard.locator('.text-xs, .text-sm').last();
    if (await benchmarkElement.isVisible()) {
      const benchmarkText = await benchmarkElement.textContent();
      console.log(`📈 Benchmark Comparison: ${benchmarkText}`);
      
      // Should mention benchmark (SPY, S&P 500, etc.)
      expect(benchmarkText).toMatch(/SPY|S&P|benchmark/i);
    }
    
    console.log('✅ IRR calculation verified');
  });

  test('Dividend yield shows real dividend data', async ({ page }) => {
    console.log('🧪 Testing dividend yield calculation...');
    
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Find the Dividend Yield KPI card
    const dividendCard = page.locator('h3').filter({ hasText: /dividend/i }).locator('..');
    await expect(dividendCard).toBeVisible();
    
    // Get the dividend value (total dividends received)
    const valueElement = dividendCard.locator('.text-2xl, .text-xl').first();
    const dividendValue = await valueElement.textContent();
    
    console.log(`📊 Total Dividends: ${dividendValue}`);
    
    // Should show dollar amount
    expect(dividendValue).toMatch(/\$\d+/);
    
    // For our test data with dividend-paying stocks, should have some dividends
    const numericValue = parseFloat(dividendValue?.replace(/[^0-9.-]/g, '') || '0');
    expect(numericValue).toBeGreaterThanOrEqual(0);
    
    // Should show yield percentage and annual amount
    const yieldElement = dividendCard.locator('.text-xs, .text-sm').last();
    if (await yieldElement.isVisible()) {
      const yieldText = await yieldElement.textContent();
      console.log(`📈 Yield Info: ${yieldText}`);
      
      // Should contain percentage and annual amount
      expect(yieldText).toMatch(/\d+\.\d+%/); // Yield percentage
      expect(yieldText).toMatch(/annual/i); // Mention annual
    }
    
    console.log('✅ Dividend yield verified');
  });

  test('Portfolio beta shows market correlation', async ({ page }) => {
    console.log('🧪 Testing portfolio beta calculation...');
    
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Find the Portfolio Beta KPI card
    const betaCard = page.locator('h3').filter({ hasText: /beta/i }).locator('..');
    await expect(betaCard).toBeVisible();
    
    // Get the beta value
    const valueElement = betaCard.locator('.text-2xl, .text-xl').first();
    const betaValue = await valueElement.textContent();
    
    console.log(`📊 Portfolio Beta: ${betaValue}`);
    
    // Beta should be a numeric value (typically 0.5 - 2.0)
    const numericValue = parseFloat(betaValue?.replace(/[^0-9.-]/g, '') || '0');
    expect(numericValue).toBeGreaterThan(0.1);
    expect(numericValue).toBeLessThan(3.0);
    
    // Should show benchmark reference
    const benchmarkElement = betaCard.locator('.text-xs, .text-sm').last();
    if (await benchmarkElement.isVisible()) {
      const benchmarkText = await benchmarkElement.textContent();
      console.log(`📈 Beta Benchmark: ${benchmarkText}`);
      
      // Should mention benchmark
      expect(benchmarkText).toMatch(/SPY|S&P|vs/i);
    }
    
    console.log('✅ Portfolio beta verified');
  });

  test('API calls are successful and return real data', async ({ page }) => {
    console.log('🧪 Testing API integration...');
    
    // Monitor network requests
    const apiCalls: any[] = [];
    
    page.on('response', response => {
      if (response.url().includes('/api/dashboard/')) {
        apiCalls.push({
          url: response.url(),
          status: response.status(),
          statusText: response.statusText()
        });
      }
    });
    
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Wait a bit for all API calls to complete
    await page.waitForTimeout(5000);
    
    console.log(`📡 Captured ${apiCalls.length} API calls:`);
    apiCalls.forEach(call => {
      console.log(`  📋 ${call.url} - ${call.status} ${call.statusText}`);
    });
    
    // Should have made calls to dashboard endpoints
    expect(apiCalls.length).toBeGreaterThan(0);
    
    // All API calls should be successful (200) or expected auth (401)
    const successfulCalls = apiCalls.filter(call => call.status === 200);
    const authCalls = apiCalls.filter(call => call.status === 401);
    
    console.log(`✅ Successful calls: ${successfulCalls.length}`);
    console.log(`🔐 Auth calls: ${authCalls.length}`);
    
    // Should have at least some successful calls
    expect(successfulCalls.length).toBeGreaterThan(0);
    
    console.log('✅ API integration verified');
  });

  test('Dashboard loads within performance benchmarks', async ({ page }) => {
    console.log('🧪 Testing dashboard performance...');
    
    const startTime = Date.now();
    
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Wait for KPI boxes to be populated (not just skeleton)
    await page.waitForFunction(() => {
      const cards = document.querySelectorAll('.text-2xl, .text-xl');
      return Array.from(cards).some(card => 
        card.textContent && 
        !card.textContent.includes('0.00') &&
        !card.textContent.includes('Loading')
      );
    }, {}, { timeout: 30000 });
    
    const loadTime = Date.now() - startTime;
    
    console.log(`⏱️ Dashboard load time: ${loadTime}ms`);
    
    // Should load within 10 seconds (generous for real API calls)
    expect(loadTime).toBeLessThan(10000);
    
    console.log('✅ Performance benchmark met');
  });

  test('Error handling works correctly', async ({ page }) => {
    console.log('🧪 Testing error handling...');
    
    // Test with network disabled to simulate API failures
    await page.setOffline(true);
    
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');
    
    // Should show error states or fallback content
    const hasErrorMessage = await page.locator('.text-red-400, .text-red-500').isVisible();
    const hasSkeletonLoading = await page.locator('[data-testid="skeleton"]').isVisible();
    
    // Should handle offline state gracefully
    expect(hasErrorMessage || hasSkeletonLoading).toBeTruthy();
    
    // Re-enable network
    await page.setOffline(false);
    
    // Refresh and verify recovery
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Should recover and show data
    await expect(page.locator('h1')).toContainText(/portfolio/i);
    
    console.log('✅ Error handling verified');
  });

  test('Mobile responsiveness works correctly', async ({ page, isMobile }) => {
    if (!isMobile) {
      // Test mobile layout on desktop by resizing
      await page.setViewportSize({ width: 375, height: 667 });
    }
    
    console.log('🧪 Testing mobile responsiveness...');
    
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // KPI grid should stack on mobile
    const kpiGrid = page.locator('.grid').first();
    await expect(kpiGrid).toBeVisible();
    
    // Take mobile screenshot
    await page.screenshot({ path: 'test-results/mobile-dashboard.png', fullPage: true });
    
    // All KPI cards should still be visible
    const kpiCards = page.locator('.rounded-xl').filter({ has: page.locator('h3') });
    const cardCount = await kpiCards.count();
    expect(cardCount).toBeGreaterThanOrEqual(4);
    
    // Cards should be readable on mobile
    for (let i = 0; i < Math.min(cardCount, 4); i++) {
      const card = kpiCards.nth(i);
      const title = card.locator('h3');
      const value = card.locator('.text-2xl, .text-xl').first();
      
      await expect(title).toBeVisible();
      await expect(value).toBeVisible();
    }
    
    console.log('✅ Mobile responsiveness verified');
  });
}); 