#!/bin/bash
echo "Portfolio Tracker - Quality Check Toggle"
echo "========================================"

if [ -f "SKIP_QUALITY_CHECKS" ]; then
    echo "Current Status: Quality checks are DISABLED"
    echo
    read -p "Do you want to ENABLE quality checks? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Deleting SKIP_QUALITY_CHECKS file..."
        rm "SKIP_QUALITY_CHECKS"
        echo
        echo "✅ Quality checks are now ENABLED"
        echo "🛡️  Code quality enforcement is active"
    fi
else
    echo "Current Status: Quality checks are ENABLED"
    echo
    read -p "Do you want to DISABLE quality checks? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Creating SKIP_QUALITY_CHECKS file..."
        cat > SKIP_QUALITY_CHECKS << EOF
# Delete this file to enable quality checks
# Create this file to skip quality checks
# 
# This file tells GitHub Actions to skip quality gate enforcement
# Use only for emergencies or hotfixes
# 
# Created: $(date)
# Reason: Emergency bypass switch
EOF
        echo
        echo "⚠️  Quality checks are now DISABLED"
        echo "⚠️  This should only be used for emergencies!"
        echo "💡 To re-enable: Run this script again or delete SKIP_QUALITY_CHECKS file"
    fi
fi

echo
read -p "Press Enter to continue..."