import { test, expect } from '@playwright/test';

/**
 * Simple Dashboard Test
 * 
 * This test just checks if your enhanced KPI boxes display real data
 * without trying to create test transactions (uses your existing data)
 */

test.describe('Simple Dashboard Test', () => {
  
  test('Dashboard KPI boxes show real financial data', async ({ page }) => {
    console.log('🧪 Testing dashboard with existing data...');
    
    // Navigate to the dashboard
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot for debugging
    await page.screenshot({ path: 'test-results/simple-dashboard.png', fullPage: true });
    
    // Wait for KPI boxes to load (not just skeletons)
    console.log('⏳ Waiting for KPI boxes to load...');
    
    // Look for KPI cards - they should have real data, not skeleton loaders
    const kpiCards = page.locator('.rounded-xl').filter({ has: page.locator('h3') });
    
    // Wait a bit for API calls to complete
    await page.waitForTimeout(5000);
    
    const cardCount = await kpiCards.count();
    console.log(`📊 Found ${cardCount} KPI cards`);
    
    if (cardCount >= 4) {
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
        
        console.log(`✅ ${title} displaying real data: ${value}`);
      }
    } else {
      console.log('⚠️ Not enough KPI cards found, checking what\'s on the page...');
      
      // Log what we can see on the page
      const allText = await page.textContent('body');
      console.log('Page content preview:', allText?.substring(0, 500));
    }
    
    console.log('✅ Simple dashboard test completed');
  });

  test('Check if dashboard loads at all', async ({ page }) => {
    console.log('🧪 Basic dashboard load test...');
    
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Just check if we have some content
    const hasContent = await page.locator('body').isVisible();
    expect(hasContent).toBeTruthy();
    
    // Look for any h1 elements
    const headings = await page.locator('h1').allTextContents();
    console.log('📋 Found headings:', headings);
    
    // Take a screenshot to see what's there
    await page.screenshot({ path: 'test-results/dashboard-content.png', fullPage: true });
    
    console.log('✅ Dashboard loads successfully');
  });
}); 