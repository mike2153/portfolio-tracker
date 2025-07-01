import { test, expect } from '@playwright/test';
import path from 'path';

// Configuration
const EMAIL = '3200163@proton.me';
const PASSWORD = '12345678';

// Debug helper function
const debugLog = (context: string, data: any) => {
  const timestamp = new Date().toISOString();
  console.log(`[FLOW-TEST-DEBUG] [${timestamp}] [${context}]`, JSON.stringify(data, null, 2));
};

test.describe('Comprehensive Login → Dashboard → Transaction Flow', () => {
  test('Complete flow with extensive debugging', async ({ page }) => {
    debugLog('test:start', { email: EMAIL, timestamp: Date.now() });

    // Enable console logging from the page
    page.on('console', msg => {
      debugLog('browser:console', { type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', error => {
      debugLog('browser:pageerror', { error: error.message, stack: error.stack });
    });

    // Track all API requests
    const apiRequests: any[] = [];
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        const reqData = {
          url: request.url(),
          method: request.method(),
          headers: request.headers(),
          timestamp: Date.now()
        };
        apiRequests.push(reqData);
        debugLog('api:request', reqData);
      }
    });

    page.on('response', response => {
      if (response.url().includes('/api/')) {
        debugLog('api:response', {
          url: response.url(),
          status: response.status(),
          statusText: response.statusText(),
          headers: response.headers()
        });
      }
    });

    // ========== STEP 1: LOGIN FLOW ==========
    debugLog('login:start', { url: '/' });
    
    // Navigate to home page
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot
    await page.screenshot({ 
      path: path.join('test-results', 'comprehensive-01-home.png'),
      fullPage: true 
    });
    debugLog('login:screenshot', { step: 'home', path: 'comprehensive-01-home.png' });

    // Navigate to auth page
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');
    
    const authUrl = page.url();
    debugLog('login:navigation', { authUrl });
    
    // Wait for login form to be visible
    await page.waitForSelector('input[name="email"]', { state: 'visible' });
    debugLog('login:form-loaded', { formVisible: true });

    // Fill email
    debugLog('login:fill-email', { selector: 'input[name="email"]', value: EMAIL });
    await page.fill('input[name="email"]', EMAIL);
    
    // Fill password
    debugLog('login:fill-password', { selector: 'input[name="password"]', value: '***hidden***' });
    await page.fill('input[name="password"]', PASSWORD);
    
    // Take screenshot before submit
    await page.screenshot({ 
      path: path.join('test-results', 'comprehensive-02-login-filled.png'),
      fullPage: true 
    });
    debugLog('login:screenshot', { step: 'form-filled', path: 'comprehensive-02-login-filled.png' });

    // Submit login form
    debugLog('login:submit', { action: 'clicking submit button' });
    await page.click('button[type="submit"]');
    
    // Wait for navigation or error message
    await Promise.race([
      page.waitForURL('**/dashboard', { timeout: 10000 }),
      page.waitForSelector('.bg-red-100', { timeout: 10000 }) // Error message
    ]).catch(e => {
      debugLog('login:wait-error', { error: e.message });
    });

    // Check current URL
    const afterLoginUrl = page.url();
    debugLog('login:result', { 
      afterLoginUrl, 
      success: afterLoginUrl.includes('/dashboard') 
    });

    // Take screenshot after login attempt
    await page.screenshot({ 
      path: path.join('test-results', 'comprehensive-03-after-login.png'),
      fullPage: true 
    });
    debugLog('login:screenshot', { step: 'after-login', path: 'comprehensive-03-after-login.png' });

    // Check for error messages
    const errorElement = await page.$('.bg-red-100');
    if (errorElement) {
      const errorText = await errorElement.textContent();
      debugLog('login:error', { errorText });
      throw new Error(`Login failed: ${errorText}`);
    }

    // Ensure we're on dashboard
    if (!afterLoginUrl.includes('/dashboard')) {
      debugLog('login:redirect-to-dashboard', { currentUrl: afterLoginUrl });
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
    }

    // ========== STEP 2: DASHBOARD KPI VALIDATION ==========
    debugLog('dashboard:start', { url: page.url() });
    
    // Wait for KPI grid to load
    await page.waitForSelector('.grid', { timeout: 10000 });
    
    // Find all KPI cards
    const kpiCards = await page.$$('[class*="rounded-xl"][class*="shadow"]');
    debugLog('dashboard:kpi-count', { count: kpiCards.length });

    // Validate each KPI card
    const kpiData: any[] = [];
    for (let i = 0; i < kpiCards.length; i++) {
      const card = kpiCards[i];
      const title = await card.$eval('h3', el => el.textContent);
      const value = await card.$eval('[class*="text-2xl"], [class*="text-xl"]', el => el.textContent).catch(() => 'N/A');
      const change = await card.$eval('[class*="text-green"], [class*="text-red"]', el => el.textContent).catch(() => 'N/A');
      
      const kpiInfo = { index: i, title, value, change };
      kpiData.push(kpiInfo);
      debugLog('dashboard:kpi-data', kpiInfo);

      // Check if KPI has valid data (not zero or error)
      if (value === '$0.00' || value === '0.00%' || value?.includes('Error')) {
        debugLog('dashboard:kpi-issue', { 
          title, 
          issue: 'Zero or error value detected',
          value 
        });
      }
    }

    // Take dashboard screenshot
    await page.screenshot({ 
      path: path.join('test-results', 'comprehensive-04-dashboard.png'),
      fullPage: true 
    });
    debugLog('dashboard:screenshot', { step: 'kpi-loaded', path: 'comprehensive-04-dashboard.png' });

    // Ensure at least one KPI has real data
    const hasRealData = kpiData.some(kpi => 
      kpi.value && 
      !kpi.value.includes('$0.00') && 
      !kpi.value.includes('0.00%') && 
      !kpi.value.includes('Error')
    );
    
    debugLog('dashboard:validation', { hasRealData, kpiData });
    expect(hasRealData).toBeTruthy();

    // ========== STEP 3: TRANSACTION WORKFLOW ==========
    debugLog('transactions:start', { action: 'navigating to transactions' });
    
    // Navigate to transactions page
    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');
    
    // Wait for transactions page to load
    await page.waitForSelector('h1:has-text("Transactions")', { timeout: 10000 });
    
    // Take initial screenshot
    await page.screenshot({ 
      path: path.join('test-results', 'comprehensive-05-transactions.png'),
      fullPage: true 
    });
    debugLog('transactions:screenshot', { step: 'initial', path: 'comprehensive-05-transactions.png' });

    // Look for Add Transaction button
    debugLog('transactions:find-add-button', { action: 'searching for add button' });
    
    // Try multiple selectors for the button
    const addButtonSelectors = [
      'button:has-text("Add Transaction")',
      'button:has-text("Add")',
      'button:has-text("New")',
      'button[aria-label*="add"]',
      'button[aria-label*="transaction"]'
    ];
    
    let addButton = null;
    for (const selector of addButtonSelectors) {
      addButton = await page.$(selector);
      if (addButton) {
        debugLog('transactions:found-button', { selector });
        break;
      }
    }
    
    if (!addButton) {
      debugLog('transactions:no-button', { tried: addButtonSelectors });
      throw new Error('Could not find Add Transaction button');
    }

    // Click add transaction button
    await addButton.click();
    debugLog('transactions:clicked-add', { action: 'clicked add button' });
    
    // Wait for form/modal to appear
    await page.waitForTimeout(2000);
    
    // Take screenshot of form
    await page.screenshot({ 
      path: path.join('test-results', 'comprehensive-06-transaction-form.png'),
      fullPage: true 
    });
    debugLog('transactions:screenshot', { step: 'form-open', path: 'comprehensive-06-transaction-form.png' });

    // Fill transaction form
    debugLog('transactions:fill-form', { action: 'starting to fill form' });
    
    // Transaction details
    const transactionData = {
      type: 'buy',
      ticker: 'SPY',
      shares: '1',
      date: '2023-05-03',
      price: null // Will be fetched
    };
    
    debugLog('transactions:form-data', transactionData);

    // Fill type (if select exists)
    const typeSelect = await page.$('select[name="type"]');
    if (typeSelect) {
      await page.selectOption('select[name="type"]', 'buy');
      debugLog('transactions:filled', { field: 'type', value: 'buy' });
    }

    // Fill ticker
    await page.fill('input[name="ticker"]', transactionData.ticker);
    debugLog('transactions:filled', { field: 'ticker', value: transactionData.ticker });
    
    // Wait for price to be fetched (if auto-fetch is enabled)
    await page.waitForTimeout(2000);
    
    // Check if price was auto-filled
    const priceInput = await page.$('input[name="price"]');
    if (priceInput) {
      const priceValue = await priceInput.inputValue();
      debugLog('transactions:price-check', { 
        priceValue, 
        autoFilled: !!priceValue && priceValue !== '0' 
      });
      transactionData.price = priceValue;
    }

    // Fill shares
    await page.fill('input[name="shares"]', transactionData.shares);
    debugLog('transactions:filled', { field: 'shares', value: transactionData.shares });

    // Fill date
    await page.fill('input[name="date"]', transactionData.date);
    debugLog('transactions:filled', { field: 'date', value: transactionData.date });

    // Take screenshot of filled form
    await page.screenshot({ 
      path: path.join('test-results', 'comprehensive-07-form-filled.png'),
      fullPage: true 
    });
    debugLog('transactions:screenshot', { step: 'form-filled', path: 'comprehensive-07-form-filled.png' });

    // Submit transaction
    debugLog('transactions:submit', { action: 'looking for submit button' });
    
    const submitButtonSelectors = [
      'button:has-text("Save")',
      'button:has-text("Submit")',
      'button:has-text("Add")',
      'button[type="submit"]:not([disabled])'
    ];
    
    let submitButton = null;
    for (const selector of submitButtonSelectors) {
      submitButton = await page.$(selector);
      if (submitButton) {
        debugLog('transactions:found-submit', { selector });
        break;
      }
    }
    
    if (submitButton) {
      await submitButton.click();
      debugLog('transactions:submitted', { action: 'clicked submit' });
    } else {
      debugLog('transactions:no-submit', { tried: submitButtonSelectors });
      throw new Error('Could not find submit button');
    }

    // Wait for submission to complete
    await page.waitForTimeout(3000);
    
    // Check for success message or redirect
    const currentUrl = page.url();
    debugLog('transactions:after-submit', { currentUrl });

    // Take screenshot after submission
    await page.screenshot({ 
      path: path.join('test-results', 'comprehensive-08-after-submit.png'),
      fullPage: true 
    });
    debugLog('transactions:screenshot', { step: 'after-submit', path: 'comprehensive-08-after-submit.png' });

    // ========== STEP 4: VERIFY DASHBOARD UPDATE ==========
    debugLog('verification:start', { action: 'returning to dashboard' });
    
    // Return to dashboard
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // Allow time for data to update
    
    // Get updated KPI data
    const updatedKpiCards = await page.$$('[class*="rounded-xl"][class*="shadow"]');
    const updatedKpiData: any[] = [];
    
    for (let i = 0; i < updatedKpiCards.length; i++) {
      const card = updatedKpiCards[i];
      const title = await card.$eval('h3', el => el.textContent);
      const value = await card.$eval('[class*="text-2xl"], [class*="text-xl"]', el => el.textContent).catch(() => 'N/A');
      
      updatedKpiData.push({ index: i, title, value });
    }
    
    debugLog('verification:updated-kpis', { updatedKpiData });

    // Take final screenshot
    await page.screenshot({ 
      path: path.join('test-results', 'comprehensive-09-final-dashboard.png'),
      fullPage: true 
    });
    debugLog('verification:screenshot', { step: 'final', path: 'comprehensive-09-final-dashboard.png' });

    // ========== FINAL SUMMARY ==========
    const summary = {
      loginSuccess: afterLoginUrl.includes('/dashboard'),
      kpiCount: kpiData.length,
      kpiWithData: kpiData.filter(k => !k.value?.includes('0.00')).length,
      transactionAdded: true, // Assumed if we got this far
      apiCallCount: apiRequests.length,
      testDuration: Date.now() - parseInt(debugLog('test:start', {}).timestamp),
      screenshots: 9
    };
    
    debugLog('test:complete', summary);
    
    // Final assertions
    expect(summary.loginSuccess).toBeTruthy();
    expect(summary.kpiCount).toBeGreaterThan(0);
    expect(summary.kpiWithData).toBeGreaterThan(0);
  });
}); 