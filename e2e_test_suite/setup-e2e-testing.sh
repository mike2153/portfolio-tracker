#!/bin/bash

# Enhanced E2E Testing Environment Setup Script
# This script sets up everything needed to run comprehensive E2E tests with real APIs

set -e  # Exit on any error

echo "🚀 Setting up Enhanced E2E Testing Environment"
echo "=============================================="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_step() {
    echo -e "${BLUE}📋 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Step 1: Check prerequisites
print_step "Checking prerequisites..."

# Check Node.js version
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//')
NODE_MAJOR=$(echo $NODE_VERSION | cut -d. -f1)

if [ "$NODE_MAJOR" -lt 18 ]; then
    print_error "Node.js version $NODE_VERSION is too old. Please install Node.js 18+ for better compatibility."
    exit 1
fi

print_success "Node.js $NODE_VERSION detected"

# Check npm
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed"
    exit 1
fi

print_success "npm detected"

# Step 2: Install dependencies
print_step "Installing E2E test dependencies..."

npm install

print_success "Dependencies installed"

# Step 3: Install Playwright browsers
print_step "Installing Playwright browsers..."

npx playwright install

if [ $? -eq 0 ]; then
    print_success "Playwright browsers installed"
else
    print_warning "Playwright browser installation had issues, but continuing..."
fi

# Step 4: Setup environment configuration
print_step "Setting up environment configuration..."

if [ ! -f "config/test.env" ]; then
    cp config/test.env.example config/test.env
    print_warning "Created config/test.env from example. Please configure your environment variables!"
    print_warning "You need to set:"
    echo "  - TEST_SUPABASE_URL"
    echo "  - TEST_SUPABASE_ANON_KEY"
    echo "  - TEST_SUPABASE_SERVICE_ROLE_KEY"
    echo "  - TEST_ALPHA_VANTAGE_API_KEY (optional, defaults to demo)"
    echo "  - TEST_USER_EMAIL"
    echo "  - TEST_USER_PASSWORD"
else
    print_success "Environment configuration file exists"
fi

# Step 5: Create test directories
print_step "Creating test result directories..."

mkdir -p test-results/screenshots
mkdir -p test-results/videos
mkdir -p test-results/traces
mkdir -p test-results/artifacts
mkdir -p test-results/html-report

print_success "Test directories created"

# Step 6: Validate backend and frontend availability
print_step "Checking if services are running..."

# Check backend
if curl -s http://localhost:8000/admin/ > /dev/null 2>&1; then
    print_success "Backend service (Django) is running on localhost:8000"
else
    print_warning "Backend service not detected on localhost:8000"
    print_warning "Make sure to start your Django backend before running tests:"
    echo "  cd ../backend && python manage.py runserver"
fi

# Check frontend
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    print_success "Frontend service (Next.js) is running on localhost:3000"
else
    print_warning "Frontend service not detected on localhost:3000"
    print_warning "Make sure to start your Next.js frontend before running tests:"
    echo "  cd ../frontend && npm run dev"
fi

# Step 7: Run a basic connectivity test
print_step "Running basic connectivity tests..."

if [ -f "config/test.env" ]; then
    source config/test.env
    
    # Test Supabase connection if configured
    if [ ! -z "$TEST_SUPABASE_URL" ] && [ ! -z "$TEST_SUPABASE_ANON_KEY" ]; then
        echo "Testing Supabase connection..."
        
        # Simple curl test to Supabase
        if curl -s -H "apikey: $TEST_SUPABASE_ANON_KEY" "$TEST_SUPABASE_URL/rest/v1/" > /dev/null 2>&1; then
            print_success "Supabase connection test passed"
        else
            print_warning "Supabase connection test failed - check your credentials"
        fi
    else
        print_warning "Supabase credentials not configured"
    fi
    
    # Test Alpha Vantage API if configured
    if [ ! -z "$TEST_ALPHA_VANTAGE_API_KEY" ] && [ "$TEST_ALPHA_VANTAGE_API_KEY" != "demo" ]; then
        echo "Testing Alpha Vantage API..."
        
        if curl -s "https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=AAPL&apikey=$TEST_ALPHA_VANTAGE_API_KEY" | grep -q "Global Quote"; then
            print_success "Alpha Vantage API test passed"
        else
            print_warning "Alpha Vantage API test failed - check your API key or rate limits"
        fi
    else
        print_warning "Using Alpha Vantage demo key (limited functionality)"
    fi
fi

# Step 8: Generate setup completion report
print_step "Generating setup report..."

cat > setup-report.md << EOF
# E2E Testing Environment Setup Report

**Setup Date:** $(date)
**Node.js Version:** $(node -v)
**npm Version:** $(npm -v)

## Installation Status
- ✅ Dependencies installed
- ✅ Playwright browsers installed
- ✅ Test directories created
- ✅ Configuration files prepared

## Next Steps

### 1. Configure Environment Variables
Edit \`config/test.env\` with your actual credentials:
\`\`\`bash
# Supabase (required)
TEST_SUPABASE_URL=https://ryitmyslspbtnktogsad.supabase.co
TEST_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5aXRteXNsc3BidG5rdG9nc2FkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAzNzA2MTgsImV4cCI6MjA2NTk0NjYxOH0.KlHHFmib82kRjZJOtOH6Aq79YAoypUZ5Ta_pGLsAxR0
TEST_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5aXRteXNsc3BidG5rdG9nc2FkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDM3MDYxOCwiZXhwIjoyMDY1OTQ2NjE4fQ.rTMEJyxkhFXU3c0pDnl32sfwzTn_galjHlNgOaxMEPw

# Test user credentials (required)
TEST_USER_EMAIL=mike21532153@hotmail.com
TEST_USER_PASSWORD=123456789

# Alpha Vantage (optional, defaults to demo)
TEST_ALPHA_VANTAGE_API_KEY=X2XXEHNZ0RMIBFU4
\`\`\`

### 2. Start Your Services
Make sure both your backend and frontend are running:
\`\`\`bash
# Terminal 1: Start Django backend
cd ../backend
python manage.py runserver

# Terminal 2: Start Next.js frontend  
cd ../frontend
npm run dev
\`\`\`

### 3. Run E2E Tests
Choose your testing mode:
\`\`\`bash
# Quick test with mock data (fast)
npm run test:e2e

# Full test with real APIs (slower, more realistic)
npm run test:e2e:real-api

# Run specific test categories
npm run test:e2e:dashboard
npm run test:e2e:auth

# Run with UI for debugging
npm run test:e2e:ui
\`\`\`

### 4. View Test Reports
After running tests, check:
- HTML Report: \`test-results/html-report/index.html\`
- Test Summary: \`test-results/test-summary.json\`
- Screenshots: \`test-results/screenshots/\`
- Videos: \`test-results/videos/\`

## Troubleshooting

### Common Issues
1. **"Cannot connect to Supabase"** - Check your URL and API keys
2. **"Alpha Vantage rate limit"** - Use demo key or wait for rate limit reset
3. **"Frontend/Backend not responding"** - Make sure services are started
4. **"Tests timeout"** - Increase timeout in playwright.config.ts

### Getting Help
- Check the README.md for detailed documentation
- Review test logs in \`test-results/\`
- Enable DEBUG mode in your environment configuration

---
Generated by Enhanced E2E Test Setup
EOF

print_success "Setup report generated: setup-report.md"

# Step 9: Final summary
echo ""
echo "🎉 E2E Testing Environment Setup Complete!"
echo "=========================================="
echo ""
echo "📋 What was installed:"
echo "  ✅ E2E test dependencies"
echo "  ✅ Playwright browsers"
echo "  ✅ Test directories and configuration"
echo ""
echo "📋 Next steps:"
echo "  1. Configure your environment variables in config/test.env"
echo "  2. Start your backend (Django) and frontend (Next.js) services"
echo "  3. Run tests with: npm run test:e2e"
echo ""
echo "📋 Available commands:"
echo "  npm run test:e2e              # Quick test with mock data"
echo "  npm run test:e2e:real-api     # Full test with real APIs"
echo "  npm run test:e2e:ui           # Interactive test mode"
echo "  npm run test:e2e:dashboard    # Dashboard-specific tests"
echo ""
echo "📊 View results at: test-results/html-report/index.html"
echo ""
print_success "Ready to run comprehensive E2E tests with real APIs!"

# Make the runner script executable
chmod +x scripts/run-e2e-tests.js

print_success "E2E test runner is now executable"

echo ""
echo "🚀 Happy testing!"