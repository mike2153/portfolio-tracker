#!/bin/bash
# Docker Health Check for Quality Monitoring

python scripts/quality_monitor.py --dashboard > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "Quality monitoring healthy"
    exit 0
else
    echo "Quality monitoring unhealthy" 
    exit 1
fi
