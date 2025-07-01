const { chromium } = require('playwright');
const readline = require('readline');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log(JSON.stringify({ ok: true, message: "Playwright MCP Server started" }));

  rl.on('line', async (line) => {
    try {
      const req = JSON.parse(line);
      let result = {};

      if (req.command === 'visit') {
        await page.goto(req.url, { waitUntil: "networkidle" });
        result = { ok: true, message: `Visited ${req.url}` };
      } else if (req.command === 'click') {
        await page.click(req.selector);
        result = { ok: true, message: `Clicked ${req.selector}` };
      } else if (req.command === 'fill') {
        await page.fill(req.selector, req.text);
        result = { ok: true, message: `Filled ${req.selector} with '${req.text}'` };
      } else if (req.command === 'screenshot') {
        const path = req.path || './screenshot.png';
        await page.screenshot({ path });
        result = { ok: true, message: `Screenshot saved to ${path}` };
      } else if (req.command === 'content') {
        const html = await page.content();
        result = { ok: true, html };
      } else if (req.command === 'exit') {
        await browser.close();
        process.exit(0);
      } else {
        result = { ok: false, message: 'Unknown command', received: req };
      }

      console.log(JSON.stringify(result));
    } catch (e) {
      console.log(JSON.stringify({ ok: false, error: e.message, stack: e.stack }));
    }
  });
})();
