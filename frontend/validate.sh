#!/bin/bash

# Frontend Validation Script
# Run this before committing any frontend changes

echo "🔍 Running Frontend Validation..."
echo "================================"

# Check if we're in the frontend directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Not in frontend directory"
    echo "Please run this script from the frontend folder"
    exit 1
fi

# Run ESLint
echo ""
echo "📝 Running ESLint..."
npm run lint
LINT_EXIT=$?

if [ $LINT_EXIT -ne 0 ]; then
    echo "❌ ESLint found errors!"
    echo "Run 'npm run validate:fix' to auto-fix some issues"
else
    echo "✅ ESLint passed!"
fi

# Run TypeScript type checking
echo ""
echo "🔍 Running TypeScript type check..."
npm run type-check
TSC_EXIT=$?

if [ $TSC_EXIT -ne 0 ]; then
    echo "❌ TypeScript found type errors!"
else
    echo "✅ TypeScript check passed!"
fi

# Check for console.log statements
echo ""
echo "🔍 Checking for console.log statements..."
CONSOLE_COUNT=$(grep -r "console.log" src/ --include="*.tsx" --include="*.ts" | grep -v "// console.log" | wc -l)

if [ $CONSOLE_COUNT -gt 0 ]; then
    echo "⚠️  Warning: Found $CONSOLE_COUNT console.log statements"
    echo "Consider removing or converting to console.error/warn"
    grep -r "console.log" src/ --include="*.tsx" --include="*.ts" | grep -v "// console.log" | head -5
else
    echo "✅ No console.log statements found!"
fi

# Check for any remaining NEXT_PUBLIC_BACKEND_API_URL
echo ""
echo "🔍 Checking for old environment variable names..."
OLD_ENV_COUNT=$(grep -r "NEXT_PUBLIC_BACKEND_API_URL" src/ --include="*.tsx" --include="*.ts" | wc -l)

if [ $OLD_ENV_COUNT -gt 0 ]; then
    echo "❌ Found old environment variable NEXT_PUBLIC_BACKEND_API_URL"
    echo "Please update to NEXT_PUBLIC_BACKEND_URL"
    grep -r "NEXT_PUBLIC_BACKEND_API_URL" src/ --include="*.tsx" --include="*.ts" | head -5
else
    echo "✅ No old environment variables found!"
fi

# Check for array index keys
echo ""
echo "🔍 Checking for array index keys..."
INDEX_KEY_COUNT=$(grep -r "key={index}" src/ --include="*.tsx" | wc -l)

if [ $INDEX_KEY_COUNT -gt 0 ]; then
    echo "❌ Found components using array index as key!"
    echo "Use stable unique identifiers instead"
    grep -r "key={index}" src/ --include="*.tsx" | head -5
else
    echo "✅ No array index keys found!"
fi

# Final summary
echo ""
echo "================================"
echo "📊 Validation Summary:"
echo "================================"

TOTAL_ERRORS=0

if [ $LINT_EXIT -ne 0 ]; then
    echo "❌ ESLint: FAILED"
    TOTAL_ERRORS=$((TOTAL_ERRORS + 1))
else
    echo "✅ ESLint: PASSED"
fi

if [ $TSC_EXIT -ne 0 ]; then
    echo "❌ TypeScript: FAILED"
    TOTAL_ERRORS=$((TOTAL_ERRORS + 1))
else
    echo "✅ TypeScript: PASSED"
fi

if [ $OLD_ENV_COUNT -gt 0 ]; then
    echo "❌ Environment Variables: NEEDS UPDATE"
    TOTAL_ERRORS=$((TOTAL_ERRORS + 1))
else
    echo "✅ Environment Variables: OK"
fi

if [ $INDEX_KEY_COUNT -gt 0 ]; then
    echo "❌ React Keys: NEEDS FIX"
    TOTAL_ERRORS=$((TOTAL_ERRORS + 1))
else
    echo "✅ React Keys: OK"
fi

echo ""
if [ $TOTAL_ERRORS -eq 0 ]; then
    echo "🎉 All checks passed! Ready to commit."
    exit 0
else
    echo "❌ Found $TOTAL_ERRORS issue(s). Please fix before committing."
    echo ""
    echo "📚 See FRONTEND_GUIDELINES.md for help"
    echo "📝 See RECENT_FIXES.md for examples"
    exit 1
fi