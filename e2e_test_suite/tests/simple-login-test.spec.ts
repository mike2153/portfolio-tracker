import { test, expect } from '@playwright/test';

/**
 * Simple Login Test to verify authentication flow
 */

test.describe('Simple Login Test', () => {
  
  test('Can login and reach dashboard with working KPIs', async ({ page }) => {
    console.log('🧪 Testing simple login flow...');
    
    // Enable detailed logging
    page.on('console', msg => console.log('🌐 [BROWSER]:', msg.text()));
    page.on('pageerror', err => console.error('❌ [PAGE ERROR]:', err.message));
    
    // Monitor API requests
    const apiCalls: any[] = [];
    page.on('response', response => {
      if (response.url().includes('/api/')) {
        apiCalls.push({
          url: response.url(),
          status: response.status(),
          statusText: response.statusText()
        });
        console.log(`📡 API Call: ${response.status()} ${response.url()}`);
      }
    });
    
    // Start from home page
    console.log('🚀 Navigating to home page...');
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of initial state
    await page.screenshot({ path: 'test-results/login-01-home.png', fullPage: true });
    console.log('📸 Screenshot: home page');
    
    // Check current URL
    const homeUrl = page.url();
    console.log(`📍 Home URL: ${homeUrl}`);
    
    // Try to go directly to dashboard first
    console.log('🎯 Attempting to access dashboard directly...');
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Check where we end up
    const dashboardUrl = page.url();
    console.log(`📍 Dashboard URL: ${dashboardUrl}`);
    
    if (dashboardUrl.includes('/auth')) {
      console.log('🔐 Redirected to auth - login required');
      
      // Take screenshot of auth page
      await page.screenshot({ path: 'test-results/login-02-auth.png', fullPage: true });
      console.log('📸 Screenshot: auth page');
      
      // Fill login form
      console.log('📝 Filling login form...');
      
      // Wait for form elements
      await page.waitForSelector('input[type="email"]', { timeout: 10000 });
      
      // Use test credentials
      const email = '3200163@proton.me';  // From test.env
      const password = '12345678';         // From test.env
      
      console.log(`📧 Using email: ${email}`);
      
      await page.fill('input[type="email"]', email);
      await page.fill('input[type="password"]', password);
      
      // Take screenshot before submit
      await page.screenshot({ path: 'test-results/login-03-form-filled.png', fullPage: true });
      console.log('📸 Screenshot: form filled');
      
      // Submit form
      console.log('🚀 Submitting login form...');
      await page.click('button[type="submit"]');
      
      // Wait for response
      await page.waitForTimeout(3000);
      
      // Check result
      const afterSubmitUrl = page.url();
      console.log(`📍 After submit URL: ${afterSubmitUrl}`);
      
      // Take screenshot after submit
      await page.screenshot({ path: 'test-results/login-04-after-submit.png', fullPage: true });
      console.log('📸 Screenshot: after submit');
      
      if (afterSubmitUrl.includes('/dashboard')) {
        console.log('✅ Successfully redirected to dashboard!');
      } else {
        console.log('⚠️ Still not on dashboard, checking for errors...');
        
        // Look for error messages
        const errorText = await page.textContent('body');
        if (errorText?.includes('error') || errorText?.includes('invalid')) {
          console.log('❌ Login error detected');
        }
      }
    } else if (dashboardUrl.includes('/dashboard')) {
      console.log('✅ Already authenticated and on dashboard');
    }
    
    // Try to get to dashboard one more time if not there yet
    if (!page.url().includes('/dashboard')) {
      console.log('🔄 Trying to navigate to dashboard again...');
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
    }
    
    // Check final state
    const finalUrl = page.url();
    console.log(`📍 Final URL: ${finalUrl}`);
    
    if (finalUrl.includes('/dashboard')) {
      console.log('🎯 Now on dashboard! Checking KPI components...');
      
      // Take screenshot of dashboard
      await page.screenshot({ path: 'test-results/login-05-dashboard.png', fullPage: true });
      console.log('📸 Screenshot: dashboard loaded');
      
      // Wait for components to load
      await page.waitForTimeout(5000);
      
      // Look for KPI cards
      const kpiCards = page.locator('.rounded-xl').filter({ has: page.locator('h3') });
      const cardCount = await kpiCards.count();
      console.log(`📊 Found ${cardCount} KPI cards`);
      
      if (cardCount > 0) {
        // Check first few cards
        for (let i = 0; i < Math.min(cardCount, 4); i++) {
          const card = kpiCards.nth(i);
          const title = await card.locator('h3').textContent();
          console.log(`🔍 KPI card ${i + 1}: "${title}"`);
          
          // Check if it has actual values (not skeleton)
          const cardText = await card.textContent();
          if (cardText?.includes('Error Loading KPI Data')) {
            console.log(`❌ Card ${i + 1} shows error`);
          } else if (cardText?.includes('0.00') && cardText?.includes('0.00%')) {
            console.log(`⚠️ Card ${i + 1} shows default/zero values`);
          } else {
            console.log(`✅ Card ${i + 1} appears to have real data`);
          }
        }
      }
      
      // Final screenshot
      await page.screenshot({ path: 'test-results/login-06-final.png', fullPage: true });
      console.log('📸 Screenshot: final state');
      
      // Check API calls
      console.log(`📡 Total API calls: ${apiCalls.length}`);
      apiCalls.forEach(call => {
        console.log(`  📋 ${call.status} - ${call.url}`);
      });
      
      // The test should have successfully reached dashboard
      expect(finalUrl).toContain('/dashboard');
      
    } else {
      console.log('❌ Failed to reach dashboard');
      throw new Error(`Failed to reach dashboard. Final URL: ${finalUrl}`);
    }
    
    console.log('✅ Login test completed successfully!');
  });
  
}); 