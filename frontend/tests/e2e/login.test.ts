import { test, expect } from '@playwright/test';

test.describe('E2E Login and Error Monitoring', () => {
  test('Login to localhost:3000 and check for console errors', async ({ page }) => {
    // Types for safety: Define expected console message types
    type ConsoleMessage = {
      type: 'error' | 'warning' | 'log';
      text: string;
    };

    const errors: ConsoleMessage[] = [];
    const warnings: ConsoleMessage[] = [];

    // Listen to console events (captures frontend errors and backend-related logs via JS)
    page.on('console', (msg) => {
      const msgType = msg.type() as 'error' | 'warning' | 'log';
      const msgText = msg.text();
      if (msgType === 'error') {
        errors.push({ type: 'error', text: msgText });
      } else if (msgType === 'warning') {
        warnings.push({ type: 'warning', text: msgText });
      }
    });

    // Listen to network responses for backend errors (e.g., 4xx/5xx from API calls)
    page.on('response', (response) => {
      if (!response.ok()) {
        errors.push({
          type: 'error',
          text: `Backend API error: ${response.url()} returned status ${response.status()} - ${response.statusText()}`,
        });
      }
    });

    // Navigate to login page (based on frontend architecture in claude.md)
    await page.goto('http://localhost:3000/auth');

    // Fill login form (selectors based on typical Supabase auth components)
    await page.fill('input[type="email"]', '3200163@proton.me'); // Email field
    await page.fill('input[type="password"]', '12345678'); // Password field
    await page.click('button[type="submit"]'); // Submit button

    // Wait for redirect to dashboard (assumes successful login redirects to /dashboard)
    await page.waitForURL('http://localhost:3000/dashboard', { timeout: 10000 });

    // Assert no errors occurred
    expect(errors).toHaveLength(0);
    expect(warnings).toHaveLength(0); // Optional: Can be adjusted to allow warnings

    // Additional check: Ensure dashboard loaded without issues
    await expect(page.locator('text=Dashboard')).toBeVisible(); // Example selector for dashboard content
  });
}); 