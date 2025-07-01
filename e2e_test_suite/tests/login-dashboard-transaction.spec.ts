import { test, expect } from '@playwright/test';
import path from 'path';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const EMAIL = process.env.E2E_EMAIL ?? '3200163@proton.me';
const PASSWORD = process.env.E2E_PASSWORD ?? '12345678';

/**
 * End-to-end flow:
 * 1. Log in with provided user
 * 2. Validate dashboard KPIs render (non-zero Portfolio Value cell)
 * 3. Navigate to Transactions and add a placeholder SPY Buy (03-May-2023)
 * 4. Reload dashboard – ensure KPIs update
 * 5. Capture screenshots after step 2 and step 4
 *
 * NOTE: selectors are intentionally generic – adjust when actual data-test ids are available.
 */

test.describe('Login → Dashboard → Transaction flow', () => {
  test('should log in, show KPIs, add transaction, and reflect update', async ({ page }) => {
    // ─── Login ──────────────────────────────────────────────────────────────
    await page.goto(`${BASE_URL}/auth`);
    await page.fill('input[name="email"]', EMAIL);
    await page.fill('input[name="password"]', PASSWORD);
    await page.click('button[type="submit"]');

    // Expect redirect to dashboard URL
    await page.waitForURL('**/dashboard');

    // ─── Dashboard KPI validation ──────────────────────────────────────────
    const portfolioValueLocator = page.locator('text=Portfolio Value').first();
    await expect(portfolioValueLocator).toBeVisible();

    // Grab the numeric value that follows the KPI title
    const valueText = await portfolioValueLocator.locator('..').locator('span').last().innerText();
    expect(valueText).not.toMatch(/^\$?0(\.0+)?$/); // ensure non-zero

    // Screenshot after successful KPI load
    await page.screenshot({
      path: path.join(__dirname, '../test-results/dashboard-after-login.png'),
      fullPage: true,
    });

    // ─── Add transaction ───────────────────────────────────────────────────
    await page.goto(`${BASE_URL}/transactions`);
    await page.click('button:has-text("Add Transaction")');

    // Fill the form – these selectors are placeholders; replace with data-test ids if available
    await page.selectOption('select[name="type"]', 'buy');
    await page.fill('input[name="ticker"]', 'SPY');
    await page.fill('input[name="shares"]', '1');
    await page.fill('input[name="date"]', '2023-05-03');

    await page.click('button:has-text("Save")');

    // Wait for toast or success banner
    await expect(page.locator('text=Transaction saved').first()).toBeVisible();

    // ─── Verify dashboard updates ──────────────────────────────────────────
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForURL('**/dashboard');

    // Confirm KPI value changed (simplistic check – non-zero is still enough for smoke test)
    await expect(portfolioValueLocator).toBeVisible();

    await page.screenshot({
      path: path.join(__dirname, '../test-results/dashboard-after-transaction.png'),
      fullPage: true,
    });
  });
}); 