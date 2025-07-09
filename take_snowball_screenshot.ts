import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

(async () => {
  const screenshotDir = path.resolve(__dirname, './idea_ss');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir);
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    await page.goto('https://snowball-analytics.com/dashboard', { waitUntil: 'networkidle' });
    await page.screenshot({ path: path.join(screenshotDir, 'snowball_dashboard.png'), fullPage: true });
    console.log('Screenshot saved to idea_ss/snowball_dashboard.png');
  } catch (err) {
    console.error('Failed to take screenshot:', err);
  } finally {
    await browser.close();
  }
})(); 