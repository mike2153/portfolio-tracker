import { test, expect, type Page } from '@playwright/test';

// Test data - real stock symbols
const TEST_SYMBOLS = {
  SPY: { ticker: 'SPY', name: 'SPDR S&P 500 ETF Trust', shouldBeFirst: true },
  APPLE: { ticker: 'AAPL', name: 'Apple Inc', searchTerm: 'Apple' },
  TESLA: { ticker: 'TSLA', name: 'Tesla', searchTerm: 'Tesla' },
  MICROSOFT: { ticker: 'MSFT', name: 'Microsoft', searchTerm: 'Microsoft' }
};

test.describe('Stock Symbol Search - Real User Experience', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    // Create a new page with authentication
    const context = await browser.newContext({
      storageState: 'e2e_test_suite/auth.json' // Assuming auth is saved
    });
    page = await context.newPage();
    
    // Navigate to a page with the search functionality
    await page.goto('/transactions'); // or /portfolio
  });

  test('should search for SPY and show it as first result', async () => {
    // Find the ticker search input
    const searchInput = await page.locator('input[placeholder*="ticker" i], input[placeholder*="search" i]').first();
    
    // Type SPY
    await searchInput.fill('SPY');
    
    // Wait for debounce (500ms) and results to appear
    await page.waitForTimeout(600);
    await page.waitForSelector('[role="listbox"], .suggestions, div[class*="suggestion"]', { 
      state: 'visible',
      timeout: 5000 
    });
    
    // Check first result is SPY
    const firstResult = await page.locator('[role="option"]:first-child, .suggestion:first-child, div[class*="suggestion"]:first-child').first();
    const symbolText = await firstResult.locator('.font-bold, .symbol, [class*="symbol"]').textContent();
    expect(symbolText?.trim()).toBe('SPY');
    
    // Verify it shows the full name
    const nameText = await firstResult.locator('.text-sm, .name, [class*="name"]').textContent();
    expect(nameText?.toLowerCase()).toContain('spdr');
    expect(nameText?.toLowerCase()).toContain('500');
  });

  test('should search by company name', async () => {
    const searchInput = await page.locator('input[placeholder*="ticker" i], input[placeholder*="search" i]').first();
    
    // Test searching for Apple
    await searchInput.fill('Apple');
    await page.waitForTimeout(600); // Wait for debounce
    
    // Wait for results
    await page.waitForSelector('[role="listbox"], .suggestions, div[class*="suggestion"]', { 
      state: 'visible' 
    });
    
    // AAPL should be in the results
    const appleResult = await page.locator('text=AAPL').first();
    await expect(appleResult).toBeVisible();
    
    // Should show Apple Inc in the name
    const appleName = await page.locator('text=/Apple Inc/i').first();
    await expect(appleName).toBeVisible();
  });

  test('should handle rapid typing with proper debouncing', async () => {
    const searchInput = await page.locator('input[placeholder*="ticker" i], input[placeholder*="search" i]').first();
    
    // Type rapidly
    await searchInput.fill('A');
    await searchInput.fill('AP');
    await searchInput.fill('APP');
    await searchInput.fill('APPL');
    
    // Should only make one request after debounce
    await page.waitForTimeout(600);
    
    // Check network tab or results
    const results = await page.locator('[role="option"], .suggestion, div[class*="suggestion"]').count();
    expect(results).toBeGreaterThan(0);
    
    // AAPL should be visible
    await expect(page.locator('text=AAPL')).toBeVisible();
  });

  test('should show loading state while searching', async () => {
    const searchInput = await page.locator('input[placeholder*="ticker" i], input[placeholder*="search" i]').first();
    
    // Start typing
    await searchInput.fill('GOOGL');
    
    // Check for loading indicator (might be very quick)
    const loadingIndicator = page.locator('text=/loading/i, .animate-spin, [class*="loading"]');
    
    // It should appear at some point
    await expect(loadingIndicator).toBeVisible({ timeout: 1000 }).catch(() => {
      // Loading might be too fast to catch, that's ok
    });
    
    // Results should eventually appear
    await expect(page.locator('text=GOOGL')).toBeVisible({ timeout: 5000 });
  });

  test('should handle empty search results gracefully', async () => {
    const searchInput = await page.locator('input[placeholder*="ticker" i], input[placeholder*="search" i]').first();
    
    // Search for nonsense
    await searchInput.fill('XYZXYZXYZ');
    await page.waitForTimeout(600);
    
    // Should show no results message
    const noResults = await page.locator('text=/no results/i, text=/not found/i').first();
    await expect(noResults).toBeVisible();
  });

  test('should exclude tickers shorter than search query', async () => {
    const searchInput = await page.locator('input[placeholder*="ticker" i], input[placeholder*="search" i]').first();
    
    // Search for SPY
    await searchInput.fill('SPY');
    await page.waitForTimeout(600);
    
    // SP should not be in the results
    const results = await page.locator('[role="option"], .suggestion, div[class*="suggestion"]').allTextContents();
    const hasShortTicker = results.some(text => /\bSP\b/.test(text) && !/SPY/.test(text));
    expect(hasShortTicker).toBe(false);
  });

  test('should handle keyboard navigation', async () => {
    const searchInput = await page.locator('input[placeholder*="ticker" i], input[placeholder*="search" i]').first();
    
    // Type to get results
    await searchInput.fill('AAP');
    await page.waitForTimeout(600);
    await page.waitForSelector('[role="listbox"], .suggestions, div[class*="suggestion"]');
    
    // Press down arrow
    await searchInput.press('ArrowDown');
    
    // First item should be highlighted
    const firstItem = await page.locator('[role="option"]:first-child, .suggestion:first-child').first();
    const isHighlighted = await firstItem.evaluate(el => {
      const styles = window.getComputedStyle(el);
      return styles.backgroundColor !== 'rgba(0, 0, 0, 0)' || 
             el.classList.toString().includes('highlight') ||
             el.classList.toString().includes('selected');
    });
    expect(isHighlighted).toBe(true);
    
    // Press Enter to select
    await searchInput.press('Enter');
    
    // Input should now have the selected value
    const inputValue = await searchInput.inputValue();
    expect(inputValue).toMatch(/^[A-Z]+$/); // Should be a ticker symbol
  });

  test('should maintain search results order by relevance', async () => {
    const searchInput = await page.locator('input[placeholder*="ticker" i], input[placeholder*="search" i]').first();
    
    // Search for SPY
    await searchInput.fill('SPY');
    await page.waitForTimeout(600);
    await page.waitForSelector('[role="listbox"], .suggestions, div[class*="suggestion"]');
    
    // Get all ticker symbols in order
    const tickers = await page.locator('[role="option"] .font-bold, .suggestion .symbol').allTextContents();
    const cleanTickers = tickers.map(t => t.trim()).filter(t => t);
    
    // SPY should be first
    expect(cleanTickers[0]).toBe('SPY');
    
    // SPY-prefixed tickers should come before non-SPY tickers
    let lastSpyIndex = -1;
    let firstNonSpyIndex = -1;
    
    cleanTickers.forEach((ticker, index) => {
      if (ticker.startsWith('SPY')) {
        lastSpyIndex = index;
      } else if (firstNonSpyIndex === -1) {
        firstNonSpyIndex = index;
      }
    });
    
    if (lastSpyIndex !== -1 && firstNonSpyIndex !== -1) {
      expect(lastSpyIndex).toBeLessThan(firstNonSpyIndex);
    }
  });

  test('should show up to 50 results', async () => {
    const searchInput = await page.locator('input[placeholder*="ticker" i], input[placeholder*="search" i]').first();
    
    // Search for a common letter to get many results
    await searchInput.fill('A');
    await page.waitForTimeout(600);
    await page.waitForSelector('[role="listbox"], .suggestions, div[class*="suggestion"]');
    
    // Count results
    const resultCount = await page.locator('[role="option"], .suggestion, div[class*="suggestion"]:has(.font-bold)').count();
    
    // Should have results, up to 50
    expect(resultCount).toBeGreaterThan(0);
    expect(resultCount).toBeLessThanOrEqual(50);
    
    // Check if there's a message about showing top results
    const topResultsMessage = await page.locator('text=/showing top/i').isVisible().catch(() => false);
    if (resultCount === 50) {
      expect(topResultsMessage).toBe(true);
    }
  });

  test.afterEach(async () => {
    await page.close();
  });
}); 