const readline = require('readline');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = 'http://localhost:3000';
const EMAIL = '3200163@proton.me';
const PASSWORD = '12345678';

// Debug helper with timestamp and context
function debugLog(context, data) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${context}] ${JSON.stringify(data, null, 2)}`;
  console.error(logEntry); // Use stderr for debug logs
  
  // Also write to debug file
  fs.appendFileSync(path.join(__dirname, 'debug.log'), logEntry + '\n');
}

// Helper to send commands to Playwright server
function sendCommand(command) {
  debugLog('sendCommand:start', { command });
  console.log(JSON.stringify(command));
  debugLog('sendCommand:sent', { command });
}

// Helper to wait (since we can't get responses synchronously)
function wait(ms) {
  debugLog('wait', { ms });
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Create screenshots directory
const screenshotsDir = path.join(__dirname, 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
  debugLog('setup', { action: 'created screenshots directory', path: screenshotsDir });
}

// Clear debug log
fs.writeFileSync(path.join(__dirname, 'debug.log'), '');
debugLog('setup', { action: 'cleared debug log' });

async function runTests() {
  debugLog('test:start', { BASE_URL, EMAIL, timestamp: Date.now() });

  // Wait for server to be ready
  await wait(2000);

  // Step 1: Visit login page
  debugLog('login:navigating', { url: `${BASE_URL}/auth` });
  sendCommand({ command: 'visit', url: `${BASE_URL}/auth` });
  await wait(5000); // Increased wait time for initial page load

  // Take screenshot of login page
  debugLog('login:screenshot', { path: '01-login-page.png' });
  sendCommand({ command: 'screenshot', path: path.join(screenshotsDir, '01-login-page.png') });
  await wait(2000);

  // Get page content to verify we're on the right page
  debugLog('login:verifying-page', { action: 'checking if login form is present' });
  sendCommand({ command: 'content' });
  await wait(2000);

  // Step 2: Fill login form
  debugLog('login:filling-email', { selector: 'input[name="email"]', value: EMAIL });
  sendCommand({ command: 'fill', selector: 'input[name="email"]', text: EMAIL });
  await wait(1000);

  debugLog('login:filling-password', { selector: 'input[name="password"]', value: '***hidden***' });
  sendCommand({ command: 'fill', selector: 'input[name="password"]', text: PASSWORD });
  await wait(1000);

  // Take screenshot after filling form
  debugLog('login:screenshot-filled', { path: '02-login-filled.png' });
  sendCommand({ command: 'screenshot', path: path.join(screenshotsDir, '02-login-filled.png') });
  await wait(2000);

  // Step 3: Submit login form
  debugLog('login:submitting', { selector: 'button[type="submit"]' });
  sendCommand({ command: 'click', selector: 'button[type="submit"]' });
  await wait(6000); // Wait longer for login to process and redirect

  // Take screenshot after login
  debugLog('login:screenshot-after-submit', { path: '03-after-login.png' });
  sendCommand({ command: 'screenshot', path: path.join(screenshotsDir, '03-after-login.png') });
  await wait(2000);

  // Get page content to check for errors or successful redirect
  debugLog('login:checking-result', { action: 'verifying login result' });
  sendCommand({ command: 'content' });
  await wait(2000);

  // Step 4: Navigate to dashboard (if not already there)
  debugLog('dashboard:navigating', { url: `${BASE_URL}/dashboard` });
  sendCommand({ command: 'visit', url: `${BASE_URL}/dashboard` });
  await wait(5000); // Wait for dashboard to load

  // Take screenshot of dashboard
  debugLog('dashboard:screenshot', { path: '04-dashboard.png' });
  sendCommand({ command: 'screenshot', path: path.join(screenshotsDir, '04-dashboard.png') });
  await wait(2000);

  // Get dashboard content to validate KPIs
  debugLog('dashboard:validating-kpis', { action: 'checking dashboard content' });
  sendCommand({ command: 'content' });
  await wait(3000);

  // Step 5: Navigate to transactions
  debugLog('transactions:navigating', { url: `${BASE_URL}/transactions` });
  sendCommand({ command: 'visit', url: `${BASE_URL}/transactions` });
  await wait(5000);

  // Take screenshot of transactions page
  debugLog('transactions:screenshot-initial', { path: '05-transactions-initial.png' });
  sendCommand({ command: 'screenshot', path: path.join(screenshotsDir, '05-transactions-initial.png') });
  await wait(2000);

  // Step 6: Click Add Transaction button
  debugLog('transactions:clicking-add', { action: 'looking for Add Transaction button' });
  // Try different selectors as button text might vary
  sendCommand({ command: 'click', selector: 'button:has-text("Add Transaction"), button:has-text("Add"), button:has-text("New Transaction")' });
  await wait(3000);

  // Take screenshot to see if modal opened
  debugLog('transactions:screenshot-modal', { path: '06-transaction-modal.png' });
  sendCommand({ command: 'screenshot', path: path.join(screenshotsDir, '06-transaction-modal.png') });
  await wait(2000);

  // Step 7: Fill transaction form
  // Note: For select elements, we might need to click and then select
  debugLog('transactions:selecting-type', { action: 'selecting buy transaction type' });
  sendCommand({ command: 'click', selector: 'select[name="type"]' });
  await wait(500);
  sendCommand({ command: 'fill', selector: 'select[name="type"]', text: 'buy' });
  await wait(1000);

  debugLog('transactions:filling-ticker', { selector: 'input[name="ticker"]', value: 'SPY' });
  sendCommand({ command: 'fill', selector: 'input[name="ticker"]', text: 'SPY' });
  await wait(1000);

  debugLog('transactions:filling-shares', { selector: 'input[name="shares"]', value: '1' });
  sendCommand({ command: 'fill', selector: 'input[name="shares"]', text: '1' });
  await wait(1000);

  debugLog('transactions:filling-date', { selector: 'input[name="date"]', value: '2023-05-03' });
  sendCommand({ command: 'fill', selector: 'input[name="date"]', text: '2023-05-03' });
  await wait(1000);

  // Take screenshot of filled form
  debugLog('transactions:screenshot-filled', { path: '07-transaction-form-filled.png' });
  sendCommand({ command: 'screenshot', path: path.join(screenshotsDir, '07-transaction-form-filled.png') });
  await wait(2000);

  // Step 8: Submit transaction
  debugLog('transactions:submitting', { action: 'looking for Save/Submit button' });
  sendCommand({ command: 'click', selector: 'button:has-text("Save"), button:has-text("Submit"), button[type="submit"]' });
  await wait(5000); // Wait for transaction to save

  // Take screenshot after submission
  debugLog('transactions:screenshot-after-save', { path: '08-transaction-saved.png' });
  sendCommand({ command: 'screenshot', path: path.join(screenshotsDir, '08-transaction-saved.png') });
  await wait(2000);

  // Step 9: Return to dashboard to verify updates
  debugLog('dashboard:returning', { url: `${BASE_URL}/dashboard` });
  sendCommand({ command: 'visit', url: `${BASE_URL}/dashboard` });
  await wait(5000);

  // Final dashboard screenshot
  debugLog('dashboard:screenshot-final', { path: '09-dashboard-final.png' });
  sendCommand({ command: 'screenshot', path: path.join(screenshotsDir, '09-dashboard-final.png') });
  await wait(2000);

  // Get final dashboard content
  debugLog('dashboard:final-validation', { action: 'checking final dashboard state' });
  sendCommand({ command: 'content' });
  await wait(3000);

  debugLog('test:complete', { timestamp: Date.now() });
  
  // Wait before exiting to ensure all commands are processed
  await wait(2000);
  
  // Exit the Playwright server
  sendCommand({ command: 'exit' });
}

// Run the tests
runTests().catch(error => {
  debugLog('test:error', { error: error.message, stack: error.stack });
  sendCommand({ command: 'exit' });
  process.exit(1);
}); 