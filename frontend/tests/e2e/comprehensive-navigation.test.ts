import { test, expect } from '@playwright/test';

// Shared error monitoring setup
const setupErrorMonitoring = (page: any) => {
  const errors: Array<{ type: string; text: string; url?: string }> = [];
  const warnings: Array<{ type: string; text: string }> = [];

  // Listen to console events (captures frontend errors)
  page.on('console', (msg: any) => {
    const msgType = msg.type();
    const msgText = msg.text();
    
    if (msgType === 'error') {
      errors.push({ type: 'console_error', text: msgText });
    } else if (msgType === 'warning') {
      warnings.push({ type: 'console_warning', text: msgText });
    }
  });

  // Listen to network responses for backend errors
  page.on('response', (response: any) => {
    if (!response.ok()) {
      errors.push({
        type: 'network_error',
        text: `API error: ${response.url()} returned status ${response.status()} - ${response.statusText()}`,
        url: response.url()
      });
    }
  });

  // Listen to page errors (uncaught exceptions)
  page.on('pageerror', (exception: any) => {
    errors.push({
      type: 'page_error',
      text: `Uncaught exception: ${exception.message}`
    });
  });

  return { errors, warnings };
};

// Shared login function
const performLogin = async (page: any) => {
  await page.goto('http://localhost:3000/auth');
  await page.fill('input[type="email"]', '3200163@proton.me');
  await page.fill('input[type="password"]', '12345678');
  await page.click('button[type="submit"]');
  await page.waitForURL('http://localhost:3000/dashboard', { timeout: 10000 });
};

test.describe('Comprehensive Navigation Tests', () => {
  
  test('Dashboard page navigation and error monitoring', async ({ page }) => {
    const { errors, warnings } = setupErrorMonitoring(page);
    
    // Login and navigate to dashboard
    await performLogin(page);
    
    // Verify dashboard loaded
    await expect(page.locator('text=My Portfolio')).toBeVisible({ timeout: 10000 });
    
    // Wait for dashboard components to load
    await page.waitForTimeout(3000);
    
    // Check for specific dashboard elements
    const dashboardElements = [
      'text=My Portfolio',
      '[data-testid="kpi-grid"], .kpi-grid, text=Total Value',
      'text=FX Ticker',
    ];
    
    for (const selector of dashboardElements) {
      try {
        await expect(page.locator(selector).first()).toBeVisible({ timeout: 5000 });
      } catch (e) {
        console.warn(`Dashboard element not found: ${selector}`);
      }
    }
    
    // Log any errors found
    if (errors.length > 0) {
      console.error('Dashboard errors found:', errors);
    }
    
    // Assert no critical errors occurred
    const criticalErrors = errors.filter(e => 
      !e.text.includes('favicon') && 
      !e.text.includes('logo.png') &&
      !e.url?.includes('_next/static')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('Analytics page navigation with all tabs', async ({ page }) => {
    const { errors, warnings } = setupErrorMonitoring(page);
    
    await performLogin(page);
    
    // Navigate to analytics
    await page.goto('http://localhost:3000/analytics');
    await expect(page.locator('text=Analytics')).toBeVisible({ timeout: 10000 });
    
    // Test all analytics tabs
    const analyticsTabs = ['holdings', 'general', 'dividends', 'returns'];
    
    for (const tab of analyticsTabs) {
      console.log(`Testing Analytics tab: ${tab}`);
      
      // Click the tab
      const tabSelector = `button:has-text("${tab.charAt(0).toUpperCase() + tab.slice(1)}")`;
      await page.click(tabSelector);
      
      // Wait for tab content to load
      await page.waitForTimeout(2000);
      
      // Verify tab is active
      await expect(page.locator(`button:has-text("${tab.charAt(0).toUpperCase() + tab.slice(1)}")`)).toHaveClass(/border-blue-500|text-blue/);
      
      // Check for tab-specific content
      if (tab === 'holdings' || tab === 'returns') {
        // These tabs should show holdings table or loading state
        try {
          await expect(page.locator('table, text=Loading, text=No holdings')).toBeVisible({ timeout: 5000 });
        } catch (e) {
          console.warn(`Holdings/Returns content not immediately visible for ${tab}`);
        }
      } else if (tab === 'dividends') {
        // Dividends tab should show dividend-specific content
        await page.waitForTimeout(1000);
      } else if (tab === 'general') {
        // General tab shows "coming soon" message
        await expect(page.locator('text=Coming soon')).toBeVisible({ timeout: 5000 });
      }
    }
    
    // Check for errors
    const criticalErrors = errors.filter(e => 
      !e.text.includes('favicon') && 
      !e.text.includes('logo.png') &&
      !e.url?.includes('_next/static')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('Portfolio page navigation with all tabs', async ({ page }) => {
    const { errors, warnings } = setupErrorMonitoring(page);
    
    await performLogin(page);
    
    // Navigate to portfolio
    await page.goto('http://localhost:3000/portfolio');
    await expect(page.locator('text=Portfolio Manager')).toBeVisible({ timeout: 10000 });
    
    // Test all portfolio tabs
    const portfolioTabs = [
      { id: 'overview', name: 'Overview' },
      { id: 'allocation', name: 'Allocation' },
      { id: 'performance', name: 'Performance' },
      { id: 'rebalance', name: 'Rebalance' }
    ];
    
    for (const tab of portfolioTabs) {
      console.log(`Testing Portfolio tab: ${tab.name}`);
      
      // Click the tab (using icon or text)
      const tabButton = page.locator(`button:has-text("${tab.name}")`);
      await tabButton.click();
      
      // Wait for tab content to load
      await page.waitForTimeout(2000);
      
      // Verify tab is active
      await expect(tabButton).toHaveClass(/border-blue-500|text-blue/);
      
      // Check for tab-specific content
      if (tab.id === 'overview') {
        // Overview should show portfolio summary and holdings
        try {
          await expect(page.locator('text=Portfolio Summary, text=Holdings, table')).toBeVisible({ timeout: 5000 });
        } catch (e) {
          console.warn('Portfolio overview content not immediately visible');
        }
      } else if (tab.id === 'allocation') {
        await expect(page.locator('text=Allocation charts coming soon')).toBeVisible({ timeout: 5000 });
      } else if (tab.id === 'performance') {
        await expect(page.locator('text=Performance Analysis')).toBeVisible({ timeout: 5000 });
      } else if (tab.id === 'rebalance') {
        await expect(page.locator('text=Rebalance Calculator Coming Soon')).toBeVisible({ timeout: 5000 });
      }
    }
    
    // Check for errors
    const criticalErrors = errors.filter(e => 
      !e.text.includes('favicon') && 
      !e.text.includes('logo.png') &&
      !e.url?.includes('_next/static')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('Research page navigation with MSFT stock and all tabs', async ({ page }) => {
    const { errors, warnings } = setupErrorMonitoring(page);
    
    await performLogin(page);
    
    // Navigate to research
    await page.goto('http://localhost:3000/research');
    await expect(page.locator('text=Stock Research')).toBeVisible({ timeout: 10000 });
    
    // Search for MSFT stock
    const searchInput = page.locator('input[placeholder*="Search stocks"]');
    await searchInput.fill('MSFT');
    await searchInput.press('Enter');
    
    // Wait for stock data to load
    await page.waitForTimeout(5000);
    
    // Verify MSFT stock is loaded
    await expect(page.locator('text=MSFT')).toBeVisible({ timeout: 10000 });
    
    // Test all research tabs
    const researchTabs = [
      { id: 'overview', name: 'Overview' },
      { id: 'financials', name: 'Financials' },
      { id: 'dividends', name: 'Dividends' },
      { id: 'news', name: 'News' },
      { id: 'notes', name: 'Notes' },
      { id: 'comparison', name: 'Compare' }
    ];
    
    for (const tab of researchTabs) {
      console.log(`Testing Research tab: ${tab.name}`);
      
      // Click the tab
      const tabButton = page.locator(`button:has-text("${tab.name}")`);
      await tabButton.click();
      
      // Wait for tab content to load
      await page.waitForTimeout(3000);
      
      // Verify tab is active
      await expect(tabButton).toHaveClass(/border-blue-500|text-blue/);
      
      // Check for tab-specific content
      if (tab.id === 'overview') {
        // Overview should show stock metrics and charts
        await page.waitForTimeout(2000);
      } else if (tab.id === 'financials') {
        // Financials should show financial data or loading
        await page.waitForTimeout(2000);
      } else if (tab.id === 'dividends') {
        // Dividends should show dividend information
        await page.waitForTimeout(2000);
      } else if (tab.id === 'news') {
        // News should show news articles or loading
        await page.waitForTimeout(2000);
      } else if (tab.id === 'notes') {
        // Notes should show notes interface
        await page.waitForTimeout(1000);
      } else if (tab.id === 'comparison') {
        // Comparison should show comparison interface
        await page.waitForTimeout(1000);
      }
    }
    
    // Check for errors
    const criticalErrors = errors.filter(e => 
      !e.text.includes('favicon') && 
      !e.text.includes('logo.png') &&
      !e.url?.includes('_next/static') &&
      !e.text.includes('ResizeObserver') // Common non-critical error
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('Watchlist page navigation and error monitoring', async ({ page }) => {
    const { errors, warnings } = setupErrorMonitoring(page);
    
    await performLogin(page);
    
    // Navigate to watchlist
    await page.goto('http://localhost:3000/watchlist');
    
    // Wait for page to load
    await page.waitForTimeout(3000);
    
    // Verify watchlist page loaded (it might be empty or have content)
    // Check for either watchlist content or empty state
    const pageLoaded = await page.locator('body').isVisible();
    expect(pageLoaded).toBe(true);
    
    // Check for errors
    const criticalErrors = errors.filter(e => 
      !e.text.includes('favicon') && 
      !e.text.includes('logo.png') &&
      !e.url?.includes('_next/static')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('Transactions page navigation and error monitoring', async ({ page }) => {
    const { errors, warnings } = setupErrorMonitoring(page);
    
    await performLogin(page);
    
    // Navigate to transactions
    await page.goto('http://localhost:3000/transactions');
    
    // Wait for page to load
    await page.waitForTimeout(3000);
    
    // Verify transactions page loaded
    const pageLoaded = await page.locator('body').isVisible();
    expect(pageLoaded).toBe(true);
    
    // Check for errors
    const criticalErrors = errors.filter(e => 
      !e.text.includes('favicon') && 
      !e.text.includes('logo.png') &&
      !e.url?.includes('_next/static')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('Settings pages navigation and error monitoring', async ({ page }) => {
    const { errors, warnings } = setupErrorMonitoring(page);
    
    await performLogin(page);
    
    // Test settings dropdown navigation
    const settingsButton = page.locator('button:has([data-testid="settings-icon"]), button:has(svg):has-text("Settings"), [data-testid="settings-button"]');
    
    // Try to find settings button by looking for settings icon or text
    const settingsSelectors = [
      'button[aria-label*="settings" i]',
      'button:has(svg) >> text=/settings/i',
      '[data-testid="settings-dropdown"]',
      'button:has-text("Settings")'
    ];
    
    let settingsFound = false;
    for (const selector of settingsSelectors) {
      try {
        const element = page.locator(selector);
        if (await element.isVisible({ timeout: 2000 })) {
          await element.click();
          settingsFound = true;
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    // If dropdown approach doesn't work, navigate directly to settings pages
    if (!settingsFound) {
      console.log('Settings dropdown not found, navigating directly to settings pages');
    }
    
    // Test settings pages directly
    const settingsPages = [
      '/settings/profile',
      '/settings/account'
    ];
    
    for (const settingsPage of settingsPages) {
      console.log(`Testing settings page: ${settingsPage}`);
      
      await page.goto(`http://localhost:3000${settingsPage}`);
      await page.waitForTimeout(2000);
      
      // Verify page loaded
      const pageLoaded = await page.locator('body').isVisible();
      expect(pageLoaded).toBe(true);
    }
    
    // Check for errors
    const criticalErrors = errors.filter(e => 
      !e.text.includes('favicon') && 
      !e.text.includes('logo.png') &&
      !e.url?.includes('_next/static')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('Navigation dropdown menus testing', async ({ page }) => {
    const { errors, warnings } = setupErrorMonitoring(page);
    
    await performLogin(page);
    
    // Test Add dropdown
    try {
      const addButton = page.locator('button:has-text("Add")');
      await addButton.click();
      
      // Wait for dropdown to appear
      await page.waitForTimeout(1000);
      
      // Check for dropdown options
      const addTransactionOption = page.locator('text=Add Transaction');
      const addDividendOption = page.locator('text=Add Dividend');
      
      if (await addTransactionOption.isVisible({ timeout: 2000 })) {
        console.log('Add dropdown menu is working');
        
        // Click outside to close dropdown
        await page.click('body', { position: { x: 100, y: 100 } });
      }
    } catch (e) {
      console.warn('Add dropdown test failed:', e);
    }
    
    // Test mobile menu if on mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);
    
    try {
      const mobileMenuButton = page.locator('button[aria-label*="menu" i], button:has(svg):has-text("Menu")');
      if (await mobileMenuButton.isVisible({ timeout: 2000 })) {
        await mobileMenuButton.click();
        await page.waitForTimeout(1000);
        
        // Check if mobile menu opened
        const mobileNav = page.locator('nav, [role="navigation"]');
        if (await mobileNav.isVisible({ timeout: 2000 })) {
          console.log('Mobile menu is working');
        }
      }
    } catch (e) {
      console.warn('Mobile menu test failed:', e);
    }
    
    // Reset viewport
    await page.setViewportSize({ width: 1280, height: 720 });
    
    // Check for errors
    const criticalErrors = errors.filter(e => 
      !e.text.includes('favicon') && 
      !e.text.includes('logo.png') &&
      !e.url?.includes('_next/static')
    );
    expect(criticalErrors).toHaveLength(0);
  });

});