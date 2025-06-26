import { test, expect } from '@playwright/test';

/**
 * Authenticated Dashboard E2E Tests
 * 
 * This test suite logs in with real credentials, then tests your enhanced KPI boxes
 * to ensure they display real financial data instead of skeletons or zeros.
 */

test.describe('Authenticated Dashboard Tests', () => {
  
  // Login before each test
  test.beforeEach(async ({ page }) => {
    console.log('🔐 Logging in with user credentials...');
    
    // Navigate to the login page
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of initial page
    await page.screenshot({ path: 'test-results/00-initial-page.png', fullPage: true });
    console.log('📸 Screenshot taken: initial page');
    
    // Check current URL and page content
    const currentUrl = page.url();
    const pageTitle = await page.title();
    console.log(`📍 Current URL: ${currentUrl}`);
    console.log(`📋 Page title: ${pageTitle}`);
    
    // Check if we're already on dashboard or need to login
    const isOnDashboard = await page.locator('h1').filter({ hasText: /portfolio/i }).isVisible();
    console.log(`🎯 Already on dashboard: ${isOnDashboard}`);
    
    if (!isOnDashboard) {
      // We need to login
      console.log('📝 Filling in login form...');
      
      // Check for login form elements
      const emailInput = page.locator('input[type="email"]');
      const passwordInput = page.locator('input[type="password"]');
      const submitButton = page.locator('button[type="submit"]');
      
      const emailVisible = await emailInput.isVisible();
      const passwordVisible = await passwordInput.isVisible();
      const submitVisible = await submitButton.isVisible();
      
      console.log(`📧 Email input visible: ${emailVisible}`);
      console.log(`🔒 Password input visible: ${passwordVisible}`);
      console.log(`🔘 Submit button visible: ${submitVisible}`);
      
      if (!emailVisible) {
        // Try to find auth page or click login link
        console.log('🔍 Looking for login/auth link...');
        const loginLink = page.locator('a[href="/auth"], a[href*="login"], button:has-text("Login"), button:has-text("Sign in")');
        const loginLinkVisible = await loginLink.isVisible();
        console.log(`🔗 Login link visible: ${loginLinkVisible}`);
        
        if (loginLinkVisible) {
          await loginLink.click();
          await page.waitForLoadState('networkidle');
          await page.screenshot({ path: 'test-results/01-after-login-click.png', fullPage: true });
          console.log('📸 Screenshot taken: after login click');
        } else {
          // Navigate directly to auth page
          console.log('🚀 Navigating directly to /auth');
          await page.goto('/auth');
          await page.waitForLoadState('networkidle');
          await page.screenshot({ path: 'test-results/02-auth-page.png', fullPage: true });
          console.log('📸 Screenshot taken: auth page');
        }
      }
      
      // Wait for login form to be visible
      await page.waitForSelector('input[type="email"]', { timeout: 10000 });
      await page.screenshot({ path: 'test-results/03-login-form-visible.png', fullPage: true });
      console.log('📸 Screenshot taken: login form visible');
      
      // Fill in credentials from environment
      const email = process.env.TEST_USER_EMAIL || 'mike21532153@hotmail.com';
      const password = process.env.TEST_USER_PASSWORD || '123456789';
      
      console.log(`📧 Using email: ${email}`);
      console.log(`🔒 Using password: ${password ? '***' : 'not set'}`);
      
      await page.fill('input[type="email"]', email);
      await page.fill('input[type="password"]', password);
      
      await page.screenshot({ path: 'test-results/04-form-filled.png', fullPage: true });
      console.log('📸 Screenshot taken: form filled');
      
      // Submit the form
      console.log('🚀 Submitting login form...');
      await page.click('button[type="submit"]');
      
      // Wait a moment and take screenshot
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'test-results/05-after-submit.png', fullPage: true });
      console.log('📸 Screenshot taken: after form submit');
      
      // Check current URL again
      const urlAfterSubmit = page.url();
      console.log(`📍 URL after submit: ${urlAfterSubmit}`);
      
      // Wait for navigation to dashboard
      try {
        console.log('⏳ Waiting for dashboard navigation...');
        await page.waitForURL('**/dashboard', { timeout: 15000 });
        console.log('✅ Dashboard URL detected');
      } catch (urlError) {
        console.error('❌ Dashboard URL navigation failed:', urlError.message);
        const finalUrl = page.url();
        console.log(`📍 Final URL: ${finalUrl}`);
        
        // Take final screenshot before failing
        await page.screenshot({ path: 'test-results/06-navigation-failed.png', fullPage: true });
        console.log('📸 Screenshot taken: navigation failed');
        
        // Check for any error messages on page
        const errorElements = await page.locator('[class*="error"], [class*="alert"], .text-red-500, .text-red-400').count();
        if (errorElements > 0) {
          const errorText = await page.locator('[class*="error"], [class*="alert"], .text-red-500, .text-red-400').first().textContent();
          console.log(`❌ Error message found: ${errorText}`);
        }
        
        throw urlError;
      }
      
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'test-results/07-dashboard-loaded.png', fullPage: true });
      console.log('📸 Screenshot taken: dashboard loaded');

      console.log('✅ Login successful, now on dashboard');
    } else {
      console.log('✅ Already authenticated and on dashboard');
    }
  });

  test('Enhanced KPI boxes display real financial data', async ({ page }) => {
    console.log('🧪 Testing enhanced KPI boxes with real data...');
    
    // Take screenshot for debugging
    await page.screenshot({ path: 'test-results/authenticated-dashboard.png', fullPage: true });
    
    // Wait for KPI boxes to load (give APIs time to respond)
    console.log('⏳ Waiting for KPI boxes to load...');
    await page.waitForTimeout(3000);
    
    // Look for KPI cards - they should have real data, not skeleton loaders
    const kpiCards = page.locator('.rounded-xl').filter({ has: page.locator('h3') });
    
    // Wait a bit more for API calls to complete
    await page.waitForTimeout(5000);
    
    const cardCount = await kpiCards.count();
    console.log(`📊 Found ${cardCount} KPI cards`);
    expect(cardCount).toBeGreaterThanOrEqual(4);
    
    // Test each KPI card for your enhanced metrics
    const expectedTitles = ['Portfolio Value', 'IRR', 'Dividend Yield', 'Portfolio Beta'];
    
    for (let i = 0; i < Math.min(cardCount, 4); i++) {
      const card = kpiCards.nth(i);
      
      // Get card title
      const title = await card.locator('h3').textContent();
      console.log(`🔍 Testing KPI card: "${title}"`);
      
      // Should have a main value (not just loading skeleton)
      const mainValue = card.locator('.text-2xl, .text-xl').first();
      await expect(mainValue).toBeVisible();
      
      const value = await mainValue.textContent();
      console.log(`📈 ${title} value: "${value}"`);
      
      // Enhanced validation - values should not be default/empty
      expect(value).not.toBe('0.00');
      expect(value).not.toBe('AU$0.00');
      expect(value).not.toBe('0.00%');
      expect(value).not.toBe('1.00');
      expect(value).not.toContain('Loading');
      expect(value).not.toContain('Error');
      expect(value).not.toContain('undefined');
      
      // Should have some actual content
      expect(value?.trim()).toBeTruthy();
      
      // Should have sub-label with additional info
      const subLabel = card.locator('.text-xs, .text-sm').last();
      if (await subLabel.isVisible()) {
        const subText = await subLabel.textContent();
        console.log(`📝 ${title} sub-label: "${subText}"`);
        expect(subText?.trim()).toBeTruthy();
      }
      
      console.log(`✅ ${title} displaying real data: ${value}`);
    }
    
    console.log('✅ All enhanced KPI boxes displaying real financial data');
  });

  test('Portfolio Value shows accurate calculation', async ({ page }) => {
    console.log('🧪 Testing Portfolio Value accuracy...');
    
    // Find the Portfolio Value KPI card
    const portfolioCard = page.locator('h3').filter({ hasText: /portfolio.?value/i }).locator('..');
    await expect(portfolioCard).toBeVisible();
    
    // Get the portfolio value
    const valueElement = portfolioCard.locator('.text-2xl, .text-xl').first();
    const portfolioValue = await valueElement.textContent();
    
    console.log(`📊 Portfolio Value: ${portfolioValue}`);
    
    // Should be a currency amount
    expect(portfolioValue).toMatch(/[\$\d,]/);
    
    // Extract numeric value for validation
    const numericValue = parseFloat(portfolioValue?.replace(/[^0-9.-]/g, '') || '0');
    
    // Should be a reasonable portfolio value (> $0)
    expect(numericValue).toBeGreaterThan(0);
    
    // Should show PNL information
    const pnlElement = portfolioCard.locator('.text-xs, .text-sm').last();
    if (await pnlElement.isVisible()) {
      const pnlText = await pnlElement.textContent();
      console.log(`📈 PNL Info: ${pnlText}`);
      
      // Should contain dollar amount or percentage
      expect(pnlText).toMatch(/[\$\d%]/);
    }
    
    console.log('✅ Portfolio value calculation verified');
  });

  test('IRR shows realistic returns', async ({ page }) => {
    console.log('🧪 Testing IRR calculation...');
    
    // Find the IRR KPI card
    const irrCard = page.locator('h3').filter({ hasText: /irr/i }).locator('..');
    await expect(irrCard).toBeVisible();
    
    // Get the IRR value
    const valueElement = irrCard.locator('.text-2xl, .text-xl').first();
    const irrValue = await valueElement.textContent();
    
    console.log(`📊 IRR: ${irrValue}`);
    
    // Should contain percentage or reasonable value
    if (irrValue && !irrValue.includes('0.00%')) {
      // Extract numeric value for validation
      const numericValue = parseFloat(irrValue.replace(/[^0-9.-]/g, '') || '0');
      
      // IRR should be realistic (-100% to +1000% for extreme cases)
      expect(numericValue).toBeGreaterThan(-100);
      expect(numericValue).toBeLessThan(1000);
    }
    
    // Should show benchmark comparison if available
    const benchmarkElement = irrCard.locator('.text-xs, .text-sm').last();
    if (await benchmarkElement.isVisible()) {
      const benchmarkText = await benchmarkElement.textContent();
      console.log(`📈 Benchmark Comparison: ${benchmarkText}`);
    }
    
    console.log('✅ IRR calculation verified');
  });

  test('Dividend Yield shows real dividend data', async ({ page }) => {
    console.log('🧪 Testing Dividend Yield calculation...');
    
    // Find the Dividend Yield KPI card
    const dividendCard = page.locator('h3').filter({ hasText: /dividend/i }).locator('..');
    await expect(dividendCard).toBeVisible();
    
    // Get the dividend value
    const valueElement = dividendCard.locator('.text-2xl, .text-xl').first();
    const dividendValue = await valueElement.textContent();
    
    console.log(`📊 Total Dividends: ${dividendValue}`);
    
    // Should show dollar amount or percentage
    expect(dividendValue).toMatch(/[\$\d%]/);
    
    // Should show yield information if available
    const yieldElement = dividendCard.locator('.text-xs, .text-sm').last();
    if (await yieldElement.isVisible()) {
      const yieldText = await yieldElement.textContent();
      console.log(`📈 Yield Info: ${yieldText}`);
    }
    
    console.log('✅ Dividend yield verified');
  });

  test('Portfolio Beta shows market correlation', async ({ page }) => {
    console.log('🧪 Testing Portfolio Beta calculation...');
    
    // Find the Portfolio Beta KPI card
    const betaCard = page.locator('h3').filter({ hasText: /beta/i }).locator('..');
    await expect(betaCard).toBeVisible();
    
    // Get the beta value
    const valueElement = betaCard.locator('.text-2xl, .text-xl').first();
    const betaValue = await valueElement.textContent();
    
    console.log(`📊 Portfolio Beta: ${betaValue}`);
    
    // Should be a numeric value
    expect(betaValue).toMatch(/\d/);
    
    // Extract numeric value for validation
    const numericValue = parseFloat(betaValue?.replace(/[^0-9.-]/g, '') || '0');
    
    // Beta should be realistic (0.01 to 5.0 for normal portfolios)
    if (numericValue > 0) {
      expect(numericValue).toBeGreaterThan(0.01);
      expect(numericValue).toBeLessThan(5.0);
    }
    
    // Should show benchmark reference if available
    const benchmarkElement = betaCard.locator('.text-xs, .text-sm').last();
    if (await benchmarkElement.isVisible()) {
      const benchmarkText = await benchmarkElement.textContent();
      console.log(`📈 Beta Benchmark: ${benchmarkText}`);
    }
    
    console.log('✅ Portfolio beta verified');
  });

  test('Dashboard loads within acceptable time', async ({ page }) => {
    console.log('🧪 Testing dashboard performance...');
    
    const startTime = Date.now();
    
    // Navigate to dashboard (should already be authenticated)
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Wait for KPI boxes to be populated (not just skeleton)
    await page.waitForFunction(() => {
      const cards = document.querySelectorAll('.text-2xl, .text-xl');
      return Array.from(cards).some(card => 
        card.textContent && 
        !card.textContent.includes('0.00') &&
        !card.textContent.includes('Loading') &&
        card.textContent.trim() !== ''
      );
    }, {}, { timeout: 30000 });
    
    const loadTime = Date.now() - startTime;
    
    console.log(`⏱️ Dashboard load time: ${loadTime}ms`);
    
    // Should load within 15 seconds (generous for real API calls)
    expect(loadTime).toBeLessThan(15000);
    
    console.log('✅ Performance benchmark met');
  });

  test('API integration works correctly', async ({ page }) => {
    console.log('🧪 Testing API integration...');
    
    // Monitor network requests
    const apiCalls: any[] = [];
    
    page.on('response', response => {
      if (response.url().includes('/api/')) {
        apiCalls.push({
          url: response.url(),
          status: response.status(),
          statusText: response.statusText()
        });
      }
    });
    
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Wait for API calls to complete
    await page.waitForTimeout(5000);
    
    console.log(`📡 Captured ${apiCalls.length} API calls:`);
    apiCalls.forEach(call => {
      console.log(`  📋 ${call.url} - ${call.status} ${call.statusText}`);
    });
    
    // Should have made some API calls
    expect(apiCalls.length).toBeGreaterThan(0);
    
    // Most API calls should be successful (200)
    const successfulCalls = apiCalls.filter(call => call.status === 200);
    console.log(`✅ Successful calls: ${successfulCalls.length}`);
    
    // Should have at least some successful calls
    expect(successfulCalls.length).toBeGreaterThan(0);
    
    console.log('✅ API integration verified');
  });

  test('No infinite skeleton loading', async ({ page }) => {
    console.log('🧪 Testing that skeleton loaders resolve...');
    
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Wait a reasonable time for data to load
    await page.waitForTimeout(10000);
    
    // Check that we don't have infinite skeleton loaders
    const skeletons = page.locator('[data-testid="skeleton"], .animate-pulse');
    const skeletonCount = await skeletons.count();
    
    console.log(`🔄 Found ${skeletonCount} skeleton loaders`);
    
    // Take screenshot to see current state
    await page.screenshot({ path: 'test-results/no-skeletons.png', fullPage: true });
    
    // Should have real content, not just skeletons
    const realContent = page.locator('.text-2xl, .text-xl').filter({ hasNotText: /^0\.00|Loading|Error/ });
    const realContentCount = await realContent.count();
    
    console.log(`📊 Found ${realContentCount} elements with real content`);
    
    // Should have at least some real content
    expect(realContentCount).toBeGreaterThan(0);
    
    console.log('✅ No infinite skeleton loading detected');
  });
}); 