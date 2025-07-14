import { test, expect } from '@playwright/test';
import path from 'path';

const EMAIL = process.env.TEST_USER_EMAIL || '3200163@proton.me';
const PASSWORD = process.env.TEST_USER_PASSWORD || '12345678';
const TICKER = 'AAPL';

test.describe('Research Page Tabs Debug E2E', () => {
  test('Login, search AAPL, view all research tabs with debug', async ({ page }) => {
    // Enable browser console logging
    page.on('console', msg => {
      console.log(`🌐 [BROWSER ${msg.type().toUpperCase()}]:`, msg.text());
    });
    page.on('pageerror', error => {
      console.error(`❌ [PAGE ERROR]:`, error.message);
    });

    // Step 1: Login
    console.log('🚀 Navigating to /auth...');
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/research-01-auth.png', fullPage: true });

    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.screenshot({ path: 'test-results/research-02-login-filled.png', fullPage: true });
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    console.log('✅ Logged in, now on dashboard');
    await page.screenshot({ path: 'test-results/research-03-dashboard.png', fullPage: true });

    // Step 2: Go to Research page
    console.log('🔎 Navigating to /research...');
    await page.goto('/research');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/research-04-research-page.png', fullPage: true });

    // Step 3: Search for AAPL
    console.log(`🔍 Typing "${TICKER}" in search bar...`);
    const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill(TICKER);
    await page.waitForTimeout(1000); // Wait for results to appear
    await page.screenshot({ path: 'test-results/research-05-search-filled.png', fullPage: true });

    // Step 4: Select AAPL from results
    const resultItem = page.locator(`text=${TICKER}`);
    await expect(resultItem).toBeVisible();
    await resultItem.click();
    await page.waitForTimeout(2000); // Wait for data to load
    await page.screenshot({ path: 'test-results/research-06-aapl-selected.png', fullPage: true });
    console.log('✅ Selected AAPL, research data should be loading');

    // Step 5: Click through each tab and take screenshots
    const tabs = [
      { label: 'Overview', selector: 'text=Overview' },
      { label: 'Financials', selector: 'text=Financials' },
      { label: 'News', selector: 'text=News' },
      { label: 'Dividends', selector: 'text=Dividends' },
      { label: 'Notes', selector: 'text=Notes' },
      { label: 'Comparison', selector: 'text=Comparison' },
    ];

    for (const [i, tab] of tabs.entries()) {
      console.log(`🗂️ Clicking tab: ${tab.label}`);
      const tabButton = page.locator(tab.selector);
      await expect(tabButton).toBeVisible();
      await tabButton.click();
      await page.waitForTimeout(1500); // Wait for tab content to load

      // Screenshot of the screen
      const screenPath = `test-results/research-tab-${i + 1}-${tab.label.toLowerCase()}.png`;
      await page.screenshot({ path: screenPath, fullPage: true });
      console.log(`📸 Screenshot: ${screenPath}`);
    }

    // Final assertion: Ensure we are still on the research page and AAPL is selected
    expect(page.url()).toContain('/research');
    const selectedTicker = await page.textContent('h1, h2, h3');
    expect(selectedTicker).toContain(TICKER);

    console.log('✅ Research tabs test completed successfully!');
  });
}); 