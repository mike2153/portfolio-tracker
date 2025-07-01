const { chromium } = require('playwright');
const readline = require('readline');

(async () => {
  console.error('[MCP-SERVER] Starting Playwright MCP Server...');
  
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
  });
  
  const page = await context.newPage();
  
  // Enable console logging from the page
  page.on('console', msg => {
    console.error(`[PAGE-CONSOLE] ${msg.type()}: ${msg.text()}`);
  });
  
  page.on('pageerror', error => {
    console.error(`[PAGE-ERROR] ${error.message}`);
  });
  
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log(JSON.stringify({ ok: true, message: "Playwright MCP Server started" }));

  rl.on('line', async (line) => {
    try {
      const req = JSON.parse(line);
      console.error(`[MCP-SERVER] Received command: ${req.command}`);
      let result = {};

      if (req.command === 'visit') {
        console.error(`[MCP-SERVER] Navigating to: ${req.url}`);
        await page.goto(req.url, { 
          waitUntil: "domcontentloaded",
          timeout: 30000 
        });
        // Wait a bit for React to render
        await page.waitForTimeout(1000);
        result = { ok: true, message: `Visited ${req.url}` };
      } else if (req.command === 'click') {
        console.error(`[MCP-SERVER] Clicking: ${req.selector}`);
        await page.click(req.selector);
        result = { ok: true, message: `Clicked ${req.selector}` };
      } else if (req.command === 'fill') {
        console.error(`[MCP-SERVER] Filling: ${req.selector} with '${req.text}'`);
        await page.fill(req.selector, req.text);
        result = { ok: true, message: `Filled ${req.selector} with '${req.text}'` };
      } else if (req.command === 'screenshot') {
        const path = req.path || './screenshot.png';
        console.error(`[MCP-SERVER] Taking screenshot: ${path}`);
        await page.screenshot({ path, fullPage: true });
        result = { ok: true, message: `Screenshot saved to ${path}` };
      } else if (req.command === 'content') {
        console.error(`[MCP-SERVER] Getting page content`);
        const html = await page.content();
        result = { ok: true, html: html.substring(0, 500) + '...' }; // Truncate for logging
      } else if (req.command === 'wait') {
        console.error(`[MCP-SERVER] Waiting ${req.ms}ms`);
        await page.waitForTimeout(req.ms);
        result = { ok: true, message: `Waited ${req.ms}ms` };
      } else if (req.command === 'exit') {
        console.error(`[MCP-SERVER] Exiting...`);
        await browser.close();
        process.exit(0);
      } else {
        result = { ok: false, message: 'Unknown command', received: req };
      }

      console.log(JSON.stringify(result));
    } catch (e) {
      console.error(`[MCP-SERVER-ERROR] ${e.message}`);
      console.log(JSON.stringify({ ok: false, error: e.message, stack: e.stack }));
    }
  });
})();
