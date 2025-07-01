# Run Playwright MCP Server and Test Client
# This script starts the server and pipes the client output to it

Write-Host "Starting Playwright MCP Test Runner..." -ForegroundColor Green
Write-Host "Credentials: 3200163@proton.me / 12345678" -ForegroundColor Yellow
Write-Host "Base URL: http://localhost:3000" -ForegroundColor Yellow
Write-Host ""

# Change to mcp_tools directory
Set-Location $PSScriptRoot

# Create a timestamp for this test run
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$logFile = "test-run-$timestamp.log"

Write-Host "Log file: $logFile" -ForegroundColor Cyan
Write-Host "Screenshots will be saved in: mcp_tools/screenshots/" -ForegroundColor Cyan
Write-Host ""

# Run the test
Write-Host "Starting test execution..." -ForegroundColor Green
try {
    # Run the client script and pipe to server
    node test-client.js | node playwright-mcp-server.js | Tee-Object -FilePath $logFile
    
    Write-Host ""
    Write-Host "Test completed!" -ForegroundColor Green
    Write-Host "Check the following for results:" -ForegroundColor Yellow
    Write-Host "  - Debug log: mcp_tools/debug.log" -ForegroundColor White
    Write-Host "  - Screenshots: mcp_tools/screenshots/" -ForegroundColor White
    Write-Host "  - Full output: mcp_tools/$logFile" -ForegroundColor White
}
catch {
    Write-Host "Error occurred: $_" -ForegroundColor Red
    exit 1
} 