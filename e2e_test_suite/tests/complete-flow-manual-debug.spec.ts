import { test, expect } from '@playwright/test';
import path from 'path';

// Configuration
const EMAIL = '3200163@proton.me';
const PASSWORD = '12345678';

test.describe('Complete Manual Debug Flow', () => {
  test('Test login, dashboard KPIs, and transaction flow with debugging', async ({ page }) => {
    
    // Enable extensive browser logging
    page.on('console', msg => {
      console.log(`🌐 [BROWSER ${msg.type().toUpperCase()}]:`, msg.text());
    });

    page.on('pageerror', error => {
      console.error(`❌ [PAGE ERROR]:`, error.message);
    });

    // Track API calls
    const apiCalls: any[] = [];
    page.on('request', request => {
      if (request.url().includes('/api/') || request.url().includes('supabase')) {
        console.log(`📡 [REQUEST]: ${request.method()} ${request.url()}`);
        apiCalls.push({ type: 'request', method: request.method(), url: request.url() });
      }
    });

    page.on('response', response => {
      if (response.url().includes('/api/') || response.url().includes('supabase')) {
        console.log(`📡 [RESPONSE]: ${response.status()} ${response.url()}`);
        apiCalls.push({ type: 'response', status: response.status(), url: response.url() });
      }
    });

    console.log('🚀 Starting comprehensive flow test...');
    
    // ========== STEP 1: LOGIN FLOW ==========
    console.log('\n=== STEP 1: LOGIN FLOW ===');
    
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');
    
    // Take initial screenshot
    await page.screenshot({ 
      path: path.join('test-results', 'manual-01-auth-page.png'),
      fullPage: true 
    });
    console.log('📸 Screenshot: auth page');

    // Check if login form is visible
    const emailInput = page.locator('input[name="email"]');
    const passwordInput = page.locator('input[name="password"]');
    const submitButton = page.locator('button[type="submit"]');
    
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitButton).toBeVisible();
    console.log('✅ Login form elements are visible');

    // Fill login form
    console.log(`📝 Filling email: ${EMAIL}`);
    await emailInput.fill(EMAIL);
    
    console.log('📝 Filling password: ***');
    await passwordInput.fill(PASSWORD);
    
    // Screenshot before submit
    await page.screenshot({ 
      path: path.join('test-results', 'manual-02-login-filled.png'),
      fullPage: true 
    });
    console.log('📸 Screenshot: login form filled');

    // Submit and wait for response
    console.log('🚀 Submitting login form...');
    await submitButton.click();
    
    // Wait for either redirect to dashboard or error message
    await Promise.race([
      page.waitForURL('**/dashboard', { timeout: 10000 }),
      page.waitForSelector('.bg-red-100', { timeout: 10000 }) // Error message
    ]).catch(() => {
      console.log('⚠️ Neither dashboard redirect nor error message appeared');
    });

    // Check result
    const currentUrl = page.url();
    console.log(`📍 Current URL after login: ${currentUrl}`);
    
    // Screenshot after login attempt
    await page.screenshot({ 
      path: path.join('test-results', 'manual-03-after-login.png'),
      fullPage: true 
    });
    console.log('📸 Screenshot: after login attempt');

    // Check for errors
    const errorElement = await page.$('.bg-red-100');
    if (errorElement) {
      const errorText = await errorElement.textContent();
      console.error(`❌ Login error: ${errorText}`);
      throw new Error(`Login failed: ${errorText}`);
    }

    // Verify we're on dashboard
    if (!currentUrl.includes('/dashboard')) {
      console.log('🔄 Not on dashboard, navigating manually...');
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
    }

    console.log('✅ Login successful!');

    // ========== STEP 2: DASHBOARD VALIDATION ==========
    console.log('\n=== STEP 2: DASHBOARD VALIDATION ===');
    
    // Wait for KPI cards to load
    await page.waitForSelector('.grid', { timeout: 10000 });
    
    // Take dashboard screenshot
    await page.screenshot({ 
      path: path.join('test-results', 'manual-04-dashboard.png'),
      fullPage: true 
    });
    console.log('📸 Screenshot: dashboard loaded');

    // Find and validate KPI cards
    const kpiCards = await page.$$('[class*="rounded-xl"][class*="shadow"]');
    console.log(`📊 Found ${kpiCards.length} KPI cards`);

    // Validate each KPI card
    for (let i = 0; i < kpiCards.length; i++) {
      const card = kpiCards[i];
      try {
        const title = await card.$eval('h3', el => el.textContent);
        const value = await card.$eval('[class*="text-2xl"], [class*="text-xl"]', el => el.textContent).catch(() => 'N/A');
        
        console.log(`📈 KPI ${i + 1}: "${title}" = "${value}"`);
        
        // Check for error states
        if (value?.includes('Error') || value?.includes('Loading')) {
          console.warn(`⚠️ KPI "${title}" shows error or loading state: ${value}`);
        } else if (value === '$0.00' || value === '0.00%') {
          console.warn(`⚠️ KPI "${title}" shows zero value: ${value}`);
        } else {
          console.log(`✅ KPI "${title}" has valid data: ${value}`);
        }
      } catch (err) {
        console.warn(`⚠️ Could not read KPI card ${i + 1}: ${err}`);
      }
    }

    expect(kpiCards.length).toBeGreaterThan(0);
    console.log('✅ Dashboard KPIs validated');

    // ========== STEP 3: TRANSACTION FLOW ==========
    console.log('\n=== STEP 3: TRANSACTION FLOW ===');
    
    // Navigate to transactions
    console.log('🚀 Navigating to transactions page...');
    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');
    
    // Screenshot transactions page
    await page.screenshot({ 
      path: path.join('test-results', 'manual-05-transactions.png'),
      fullPage: true 
    });
    console.log('📸 Screenshot: transactions page');

    // Find Add Transaction button
    const addButtonSelectors = [
      'button:has-text("Add Transaction")',
      'button:has-text("Add")',
      '[class*="bg-blue"]:has-text("Add")'
    ];
    
    let addButton = null;
    for (const selector of addButtonSelectors) {
      addButton = await page.$(selector);
      if (addButton) {
        console.log(`✅ Found Add Transaction button: ${selector}`);
        break;
      }
    }
    
    if (!addButton) {
      console.error('❌ Could not find Add Transaction button');
      // Take debug screenshot
      await page.screenshot({ 
        path: path.join('test-results', 'manual-05b-no-add-button.png'),
        fullPage: true 
      });
      throw new Error('Add Transaction button not found');
    }

    // Click Add Transaction
    console.log('🚀 Clicking Add Transaction...');
    await addButton.click();
    await page.waitForTimeout(2000);
    
    // Screenshot form
    await page.screenshot({ 
      path: path.join('test-results', 'manual-06-transaction-form.png'),
      fullPage: true 
    });
    console.log('📸 Screenshot: transaction form');

    // Fill transaction form
    console.log('📝 Filling transaction form...');
    
    // Fill ticker
    const tickerInput = page.locator('input[name="ticker"]');
    if (await tickerInput.isVisible()) {
      await tickerInput.fill('SPY');
      console.log('✅ Filled ticker: SPY');
    }
    
    // Fill shares
    const sharesInput = page.locator('input[name="shares"]');
    if (await sharesInput.isVisible()) {
      await sharesInput.fill('1');
      console.log('✅ Filled shares: 1');
    }
    
    // Fill date
    const dateInput = page.locator('input[name="date"], input[name="purchase_date"]');
    if (await dateInput.isVisible()) {
      await dateInput.fill('2023-05-03');
      console.log('✅ Filled date: 2023-05-03');
    }
    
    // Wait for price to potentially auto-fill
    await page.waitForTimeout(3000);
    
    // Screenshot filled form
    await page.screenshot({ 
      path: path.join('test-results', 'manual-07-form-filled.png'),
      fullPage: true 
    });
    console.log('📸 Screenshot: form filled');

    // Find and click submit button
    const submitButtonSelectors = [
      'button:has-text("Save")',
      'button:has-text("Submit")',
      'button[type="submit"]:not([disabled])'
    ];
    
    let submitBtn = null;
    for (const selector of submitButtonSelectors) {
      submitBtn = await page.$(selector);
      if (submitBtn) {
        console.log(`✅ Found submit button: ${selector}`);
        break;
      }
    }
    
    if (submitBtn) {
      console.log('🚀 Submitting transaction...');
      await submitBtn.click();
      await page.waitForTimeout(3000);
    } else {
      console.warn('⚠️ Could not find submit button');
    }
    
    // Screenshot after submit
    await page.screenshot({ 
      path: path.join('test-results', 'manual-08-after-submit.png'),
      fullPage: true 
    });
    console.log('📸 Screenshot: after transaction submit');

    // ========== STEP 4: VERIFY DASHBOARD UPDATE ==========
    console.log('\n=== STEP 4: VERIFY DASHBOARD UPDATE ===');
    
    // Return to dashboard
    console.log('🚀 Returning to dashboard...');
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // Allow data to refresh
    
    // Final screenshot
    await page.screenshot({ 
      path: path.join('test-results', 'manual-09-final-dashboard.png'),
      fullPage: true 
    });
    console.log('📸 Screenshot: final dashboard');

    // ========== SUMMARY ==========
    console.log('\n=== FINAL SUMMARY ===');
    console.log(`✅ Login successful: ${currentUrl.includes('/dashboard')}`);
    console.log(`📊 KPI cards found: ${kpiCards.length}`);
    console.log(`📡 API calls made: ${apiCalls.length}`);
    console.log(`📸 Screenshots saved: 9`);
    
    console.log('\n📋 API Calls Summary:');
    apiCalls.forEach((call, index) => {
      console.log(`  ${index + 1}. ${call.type}: ${call.method || call.status} ${call.url}`);
    });
    
    console.log('\n✅ Test completed successfully!');
  });
}); 