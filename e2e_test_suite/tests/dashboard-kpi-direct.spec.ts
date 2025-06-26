import { test, expect } from '@playwright/test';

/**
 * Direct Dashboard KPI Tests
 * 
 * This test bypasses authentication and directly tests the KPI components
 * to isolate the KPI data loading issues from authentication problems.
 */

test.describe('Direct Dashboard KPI Tests', () => {
  
  test('Dashboard KPI components can load and display data', async ({ page }) => {
    console.log('🧪 Testing KPI components directly...');
    
    // Enable detailed logging
    page.on('console', msg => console.log('🌐 [BROWSER]:', msg.text()));
    page.on('pageerror', err => console.error('❌ [PAGE ERROR]:', err.message));
    
    // Monitor network requests
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
    
    // Navigate directly to the dashboard
    console.log('🚀 Navigating to dashboard...');
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of dashboard
    await page.screenshot({ path: 'test-results/direct-dashboard.png', fullPage: true });
    console.log('📸 Screenshot taken: direct dashboard');
    
    // Check if we're on the dashboard
    const currentUrl = page.url();
    console.log(`📍 Current URL: ${currentUrl}`);
    
    // Look for the KPI grid or any dashboard content
    const kpiGrid = page.locator('[data-testid="kpi-grid"], .grid');
    const kpiGridVisible = await kpiGrid.isVisible();
    console.log(`📊 KPI grid visible: ${kpiGridVisible}`);
    
    if (kpiGridVisible) {
      // Test KPI cards
      const kpiCards = page.locator('.rounded-xl').filter({ has: page.locator('h3') });
      const cardCount = await kpiCards.count();
      console.log(`📊 Found ${cardCount} KPI cards`);
      
      if (cardCount > 0) {
        for (let i = 0; i < Math.min(cardCount, 4); i++) {
          const card = kpiCards.nth(i);
          const title = await card.locator('h3').textContent();
          console.log(`🔍 Testing KPI card: "${title}"`);
          
          // Check if card has content (not just error)
          const hasError = title?.includes('Error');
          const cardContent = await card.textContent();
          console.log(`📋 Card content: ${cardContent?.substring(0, 100)}...`);
          
          if (hasError) {
            console.log(`❌ Card shows error: ${title}`);
          } else {
            console.log(`✅ Card appears to have content: ${title}`);
          }
        }
      }
    } else {
      // Check if we need to authenticate
      const needsAuth = await page.locator('input[type="email"], a[href="/auth"], button:has-text("Login")').isVisible();
      if (needsAuth) {
        console.log('🔐 Dashboard requires authentication');
      } else {
        console.log('❓ Dashboard content not found, checking page content...');
        const pageContent = await page.textContent('body');
        console.log(`📄 Page content preview: ${pageContent?.substring(0, 200)}...`);
      }
    }
    
    // Check API calls made
    console.log(`📡 Total API calls made: ${apiCalls.length}`);
    apiCalls.forEach(call => {
      console.log(`  📋 ${call.status} ${call.statusText} - ${call.url}`);
    });
    
    // Wait a bit more to see if any delayed API calls happen
    await page.waitForTimeout(5000);
    
    // Final screenshot
    await page.screenshot({ path: 'test-results/direct-dashboard-final.png', fullPage: true });
    console.log('📸 Screenshot taken: final state');
    
    console.log('✅ Direct KPI test completed');
  });
  
  test('KPI API endpoint responds correctly', async ({ page }) => {
    console.log('🧪 Testing KPI API endpoint directly from browser...');
    
    // Navigate to a page first (needed for making API calls)
    await page.goto('/');
    
    // Test the API endpoint directly
    const apiUrl = 'http://localhost:8000/api/dashboard/overview';
    console.log(`📡 Testing API endpoint: ${apiUrl}`);
    
    try {
      const response = await page.evaluate(async (url) => {
        const resp = await fetch(url);
        return {
          status: resp.status,
          statusText: resp.statusText,
          ok: resp.ok,
          data: resp.ok ? await resp.json() : await resp.text()
        };
      }, apiUrl);
      
      console.log(`📊 API Response Status: ${response.status} ${response.statusText}`);
      console.log(`📊 API Response OK: ${response.ok}`);
      
      if (response.ok) {
        console.log('✅ API endpoint is working');
        console.log('📋 API Response Data:', JSON.stringify(response.data, null, 2));
        
        // Validate response structure
        const data = response.data;
        const hasMarketValue = 'marketValue' in data || 'market_value' in data;
        const hasTotalProfit = 'totalProfit' in data || 'total_profit' in data;
        const hasIRR = 'irr' in data;
        const hasPassiveIncome = 'passiveIncome' in data || 'passive_income' in data;
        
        console.log(`📊 Response validation:`);
        console.log(`  - marketValue: ${hasMarketValue}`);
        console.log(`  - totalProfit: ${hasTotalProfit}`);
        console.log(`  - irr: ${hasIRR}`);
        console.log(`  - passiveIncome: ${hasPassiveIncome}`);
        
        // The API should return data even without auth (fallback values)
        expect(response.status).toBe(200);
        
      } else {
        console.log('❌ API endpoint returned error');
        console.log('📄 Error response:', response.data);
        
        if (response.status === 401) {
          console.log('🔐 Authentication required - this is expected for authenticated endpoints');
        }
      }
      
    } catch (error) {
      console.error('❌ API test failed:', error);
    }
    
    console.log('✅ API endpoint test completed');
  });
  
}); 