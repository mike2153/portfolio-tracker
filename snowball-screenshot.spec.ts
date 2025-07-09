import { test } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

test('Take screenshot of Snowball Analytics dashboard in local Chrome', async () => {
  const screenshotDir = path.resolve(__dirname, './idea_ss');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir);
  }

  // Path to local Chrome installation (default for Windows)
  const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

  const browser = await chromium.launch({
    headless: false, // set to true for headless mode
    executablePath: chromePath,
  });
  const page = await browser.newPage();

  await page.goto('https://snowball-analytics.com/dashboard', { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(screenshotDir, 'snowball_dashboard.png'), fullPage: true });

  await browser.close();
}); 