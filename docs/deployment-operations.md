# Portfolio Tracker - Deployment and Operations Guide

**Version**: 2.0 | **Last Updated**: 2025-07-31 | **Status**: Production Ready

## Table of Contents

1. [Deployment Overview](#deployment-overview)
2. [Docker Deployment](#docker-deployment)
3. [Environment Configuration](#environment-configuration)
4. [Database Operations](#database-operations)
5. [Monitoring and Observability](#monitoring-and-observability)
6. [Security Operations](#security-operations)
7. [Performance Optimization](#performance-optimization)
8. [Troubleshooting Procedures](#troubleshooting-procedures)
9. [Backup and Recovery](#backup-and-recovery)
10. [Maintenance Procedures](#maintenance-procedures)

---

## Deployment Overview

### System Architecture

The Portfolio Tracker system consists of three main components:

```
┌─────────────────────────────────────────────────────────────┐
│                     Production Architecture                 │
├─────────────────────────────────────────────────────────────┤
│  Frontend (Next.js)    →    Backend (FastAPI)    →    DB   │
│  Port: 3000                 Port: 8000             Supabase │
│  Docker: frontend          Docker: backend                  │
└─────────────────────────────────────────────────────────────┘
```

### Deployment Environments

- **Development**: Local Docker containers with hot reload
- **Staging**: Production-like environment for testing
- **Production**: Full production deployment with monitoring

---

## Docker Deployment

### Development Environment

#### Prerequisites
```bash
# Install required tools
docker --version          # Docker 20.10+
docker-compose --version  # Docker Compose 2.0+
node --version            # Node.js 18+
python --version          # Python 3.11+
```

#### Quick Start Development Setup
```bash
# Clone and enter project directory
cd portfolio-tracker

# Copy environment template
cp .env.example .env.local

# Configure environment variables (see Environment Configuration section)
nano .env.local

# Start development environment
docker-compose -f docker-compose.dev.yml up -d

# Verify services are running
docker-compose -f docker-compose.dev.yml ps
```

#### Development Docker Configuration

**Frontend Development (docker-compose.dev.yml)**:
```yaml
version: '3.8'
services:
  frontend-dev:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    volumes:
      - ./frontend:/app
      - /app/node_modules
      - /app/.next
    environment:
      - NODE_ENV=development
      - NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
    depends_on:
      - backend-dev

  backend-dev:
    build:
      context: ./backend
      dockerfile: Dockerfile.dev
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app
    environment:
      - BACKEND_API_DEBUG=true
      - BACKEND_API_PORT=8000
    env_file:
      - .env.local
```

**Frontend Dockerfile.dev**:
```dockerfile
FROM node:18-alpine
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Enable hot reload for Docker
ENV WATCHPACK_POLLING=true

EXPOSE 3000
CMD ["npm", "run", "dev"]
```

**Backend Dockerfile.dev**:
```dockerfile
FROM python:3.11-slim
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Enable development mode
ENV PYTHONPATH=/app
ENV BACKEND_API_DEBUG=true

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

### Production Environment

#### Production Docker Configuration

**docker-compose.prod.yml**:
```yaml
version: '3.8'
services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.prod
    ports:
      - "80:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env.production
    restart: unless-stopped
    depends_on:
      - backend

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    ports:
      - "8000:8000"
    environment:
      - BACKEND_API_DEBUG=false
    env_file:
      - .env.production
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/ssl/private:ro
    depends_on:
      - frontend
      - backend
    restart: unless-stopped
```

**Frontend Dockerfile.prod**:
```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Build application
COPY . .
RUN npm run build

# Production image
FROM node:18-alpine AS runner
WORKDIR /app

# Copy built application
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Security: Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001
USER nextjs

EXPOSE 3000
CMD ["npm", "start"]
```

**Backend Dockerfile.prod**:
```dockerfile
FROM python:3.11-slim AS builder
WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

# Production image
FROM python:3.11-slim
WORKDIR /app

# Copy dependencies
COPY --from=builder /root/.local /root/.local

# Copy application
COPY . .

# Security: Create non-root user
RUN useradd -m -u 1001 appuser
USER appuser

# Update PATH
ENV PATH=/root/.local/bin:$PATH
ENV PYTHONPATH=/app

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

#### Production Deployment Commands

```bash
# Production deployment
docker-compose -f docker-compose.prod.yml up -d

# Scale backend for high load
docker-compose -f docker-compose.prod.yml up -d --scale backend=3

# Rolling update (zero downtime)
docker-compose -f docker-compose.prod.yml up -d --no-deps --build backend
docker-compose -f docker-compose.prod.yml up -d --no-deps --build frontend

# Health check
curl -f http://localhost:8000/health || exit 1
curl -f http://localhost:3000/api/health || exit 1
```

---

## Environment Configuration

### Required Environment Variables

#### Frontend Environment Variables (.env.local / .env.production)
```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Backend API Configuration
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000  # Dev
NEXT_PUBLIC_API_BASE_URL=https://api.yourdomain.com  # Prod

# Application Configuration
NEXT_PUBLIC_ENVIRONMENT=development  # development | staging | production

# Feature Flags (Optional)
NEXT_PUBLIC_ENABLE_DEBUG=true
NEXT_PUBLIC_ENABLE_ANALYTICS=true
```

#### Backend Environment Variables (.env.local / .env.production)
```bash
# Supabase Configuration (Required)
SUPA_API_URL=https://your-project.supabase.co
SUPA_API_ANON_KEY=your-anon-key
SUPA_API_SERVICE_KEY=your-service-key

# Alpha Vantage API (Required)
VANTAGE_API_KEY=your-alpha-vantage-key

# Backend Configuration
BACKEND_API_PORT=8000
BACKEND_API_DEBUG=false  # true for development
BACKEND_API_HOST=0.0.0.0

# CORS Configuration
FRONTEND_URL=http://localhost:3000  # Dev
FRONTEND_URL=https://yourdomain.com  # Prod

# Security Configuration
JWT_SECRET_KEY=your-super-secret-jwt-key
ENCRYPTION_KEY=your-32-character-encryption-key

# Database Configuration (if using custom PostgreSQL)
DATABASE_URL=postgresql://user:password@host:port/database

# External Services (Optional)
REDIS_URL=redis://localhost:6379
SMTP_SERVER=smtp.yourdomain.com
SMTP_PORT=587
SMTP_USERNAME=noreply@yourdomain.com
SMTP_PASSWORD=your-smtp-password
```

### Environment Security Best Practices

#### Production Security Checklist
```bash
# 1. Use strong, unique keys
openssl rand -base64 32  # Generate 32-character key

# 2. Set proper file permissions
chmod 600 .env.production
chown root:root .env.production

# 3. Use secret management in production
# AWS Secrets Manager / Azure Key Vault / Google Secret Manager

# 4. Validate required variables
python scripts/validate_environment.py --env production

# 5. Rotate keys regularly (quarterly)
```

#### Environment Validation Script
```python
# scripts/validate_environment.py
import os
import sys
from typing import List, Dict

REQUIRED_FRONTEND_VARS = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_API_BASE_URL'
]

REQUIRED_BACKEND_VARS = [
    'SUPA_API_URL',
    'SUPA_API_ANON_KEY', 
    'SUPA_API_SERVICE_KEY',
    'VANTAGE_API_KEY'
]

def validate_environment(env_type: str) -> bool:
    """Validate required environment variables"""
    missing_vars = []
    
    if env_type in ['frontend', 'all']:
        missing_vars.extend([
            var for var in REQUIRED_FRONTEND_VARS 
            if not os.getenv(var)
        ])
    
    if env_type in ['backend', 'all']:
        missing_vars.extend([
            var for var in REQUIRED_BACKEND_VARS 
            if not os.getenv(var)
        ])
    
    if missing_vars:
        print(f"❌ Missing required environment variables:")
        for var in missing_vars:
            print(f"   - {var}")
        return False
    
    print(f"✅ All required environment variables present")
    return True

if __name__ == "__main__":
    env_type = sys.argv[1] if len(sys.argv) > 1 else 'all'
    if not validate_environment(env_type):
        sys.exit(1)
```

---

## Database Operations

### Migration Management

#### Database Migration Procedures
```bash
# Check current migration status
python scripts/check_migration_status.py

# Apply pending migrations
supabase db push

# Apply specific migration
psql -f supabase/migrations/008_comprehensive_rls_policies.sql

# Rollback migration (if rollback script exists)
psql -f supabase/migrations/008_comprehensive_rls_policies_rollback.sql

# Validate migration success
python scripts/validate_database_schema.py
```

#### Migration Safety Checklist
```bash
# Pre-migration checks
□ Database backup completed
□ Migration tested in staging environment
□ Rollback script prepared and tested
□ Application maintenance mode enabled (if needed)
□ All dependent services notified

# Post-migration checks
□ Schema validation passed
□ RLS policies functioning correctly
□ Application functionality verified
□ Performance metrics within normal range
□ Rollback procedure tested (if safe to do so)
```

### Database Monitoring

#### Performance Monitoring Queries
```sql
-- Check slow queries
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    min_time,
    max_time
FROM pg_stat_statements 
ORDER BY total_time DESC 
LIMIT 10;

-- Check index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes 
ORDER BY idx_scan DESC;

-- Check table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

#### RLS Policy Validation
```bash
# Validate RLS policies are active
python scripts/validate_rls_policies.py --strict

# Test cross-user data isolation
python scripts/test_data_isolation.py --user-count 10

# Security audit
python scripts/security_audit.py --full-scan
```

### Backup Procedures

#### Automated Database Backup
```bash
#!/bin/bash
# scripts/backup_database.sh

BACKUP_DIR="/backups/portfolio-tracker"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$DATE.sql"

# Create backup directory
mkdir -p $BACKUP_DIR

# Create backup
pg_dump $DATABASE_URL > $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

# Verify backup
if [ $? -eq 0 ]; then
    echo "✅ Backup created successfully: $BACKUP_FILE.gz"
    
    # Upload to cloud storage (optional)
    # aws s3 cp $BACKUP_FILE.gz s3://your-backup-bucket/
    
    # Clean up old backups (keep last 30 days)
    find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +30 -delete
else
    echo "❌ Backup failed"
    exit 1
fi
```

#### Backup Automation (Cron Job)
```bash
# Add to crontab: crontab -e
# Daily backup at 2 AM
0 2 * * * /path/to/scripts/backup_database.sh >> /var/log/backup.log 2>&1

# Weekly full backup with verification
0 3 * * 0 /path/to/scripts/backup_database.sh --full --verify >> /var/log/backup.log 2>&1
```

---

## Monitoring and Observability

### Application Health Monitoring

#### Health Check Endpoints
```python
# Backend health check
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "2.0.0",
        "database": await check_database_connection(),
        "external_apis": await check_external_services()
    }

# Detailed system status
@app.get("/status")
async def system_status():
    return {
        "database": {
            "connected": await check_database_connection(),
            "migrations": await get_migration_status(),
            "rls_policies": await validate_rls_policies()
        },
        "external_services": {
            "alpha_vantage": await check_alpha_vantage_api(),
            "supabase": await check_supabase_connection()
        },
        "performance": {
            "response_time": await measure_response_time(),
            "memory_usage": get_memory_usage(),
            "cpu_usage": get_cpu_usage()
        }
    }
```

#### Frontend Health Monitoring
```typescript
// pages/api/health.ts
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version,
    environment: process.env.NODE_ENV,
    backend_connectivity: checkBackendConnection(),
    build_info: {
      commit: process.env.VERCEL_GIT_COMMIT_SHA || 'unknown',
      branch: process.env.VERCEL_GIT_COMMIT_REF || 'unknown'
    }
  };
  
  res.status(200).json(health);
}
```

### Real-Time Quality Monitoring

#### Quality Dashboard Setup
```bash
# Start quality monitoring dashboard
python scripts/quality_monitor.py --dashboard --port 8080

# View dashboard
open http://localhost:8080/quality-dashboard.html

# Set up automated monitoring (runs every 5 minutes)
*/5 * * * * python scripts/quality_monitor.py --check-all --alert-on-failure
```

#### Quality Metrics Collection
```python
# scripts/collect_metrics.py
import json
import time
from datetime import datetime
from pathlib import Path

class MetricsCollector:
    def __init__(self):
        self.metrics_dir = Path("metrics")
        self.metrics_dir.mkdir(exist_ok=True)
    
    def collect_performance_metrics(self):
        """Collect system performance metrics"""
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "response_times": {
                "backend_health": self.measure_endpoint_response("/health"),
                "frontend_health": self.measure_endpoint_response("/api/health"),
                "dashboard_load": self.measure_page_load("/dashboard")
            },
            "resource_usage": {
                "memory_usage_mb": self.get_memory_usage(),
                "cpu_usage_percent": self.get_cpu_usage(),
                "disk_usage_percent": self.get_disk_usage()
            },
            "error_rates": {
                "backend_errors": self.count_backend_errors(),
                "frontend_errors": self.count_frontend_errors(),
                "database_errors": self.count_database_errors()
            }
        }
    
    def save_metrics(self, metric_type: str, data: dict):
        """Save metrics to JSON file"""
        file_path = self.metrics_dir / f"{metric_type}_{datetime.now().strftime('%Y%m%d')}.json"
        
        # Load existing data
        existing_data = []
        if file_path.exists():
            with open(file_path) as f:
                existing_data = json.load(f)
        
        # Append new data
        existing_data.append(data)
        
        # Save updated data
        with open(file_path, 'w') as f:
            json.dump(existing_data, f, indent=2)
```

### Logging Configuration

#### Structured Logging Setup
```python
# Backend logging configuration
import logging
import json
from datetime import datetime

class StructuredLogger:
    def __init__(self, name: str):
        self.logger = logging.getLogger(name)
        handler = logging.StreamHandler()
        handler.setFormatter(JsonFormatter())
        self.logger.addHandler(handler)
        self.logger.setLevel(logging.INFO)
    
    def log_api_call(self, endpoint: str, method: str, status_code: int, 
                     response_time: float, user_id: str = None):
        """Log API call with structured data"""
        self.logger.info("API call", extra={
            "event_type": "api_call",
            "endpoint": endpoint,
            "method": method,
            "status_code": status_code,
            "response_time_ms": response_time,
            "user_id": user_id,
            "timestamp": datetime.utcnow().isoformat()
        })

class JsonFormatter(logging.Formatter):
    def format(self, record):
        log_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno
        }
        
        # Add extra fields if present
        if hasattr(record, 'event_type'):
            log_data.update({
                key: value for key, value in record.__dict__.items()
                if key not in ['name', 'msg', 'args', 'levelname', 'levelno', 
                              'pathname', 'filename', 'module', 'lineno', 
                              'funcName', 'created', 'msecs', 'relativeCreated',
                              'thread', 'threadName', 'processName', 'process']
            })
        
        return json.dumps(log_data)
```

#### Log Aggregation Setup
```bash
# Docker Compose logging configuration
services:
  backend:
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
        labels: "service=backend"
  
  frontend:
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
        labels: "service=frontend"

# Centralized logging with ELK stack (optional)
# docker-compose -f docker-compose.logging.yml up -d
```

---

## Security Operations

### SSL/TLS Configuration

#### Nginx SSL Configuration
```nginx
# nginx.conf
events {
    worker_connections 1024;
}

http {
    upstream frontend {
        server frontend:3000;
    }
    
    upstream backend {
        server backend:8000;
    }
    
    # HTTP to HTTPS redirect
    server {
        listen 80;
        server_name yourdomain.com www.yourdomain.com;
        return 301 https://$server_name$request_uri;
    }
    
    # HTTPS configuration
    server {
        listen 443 ssl http2;
        server_name yourdomain.com www.yourdomain.com;
        
        # SSL certificates
        ssl_certificate /etc/ssl/private/fullchain.pem;
        ssl_certificate_key /etc/ssl/private/privkey.pem;
        
        # SSL configuration
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
        ssl_prefer_server_ciphers off;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 10m;
        
        # Security headers
        add_header Strict-Transport-Security "max-age=31536000" always;
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        
        # Frontend routing
        location / {
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
        
        # Backend API routing
        location /api/ {
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

### Security Scanning

#### Automated Security Scanning
```bash
#!/bin/bash
# scripts/security_scan.py

# Container security scanning
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
    -v $(pwd):/project \
    aquasec/trivy image portfolio-tracker-backend:latest

docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
    -v $(pwd):/project \
    aquasec/trivy image portfolio-tracker-frontend:latest

# Dependency vulnerability scanning
npm audit --audit-level moderate
pip-audit

# Code security scanning
bandit -r backend/ -f json -o security-report.json

# Database security validation
python scripts/validate_rls_policies.py --security-audit
python scripts/detect_raw_sql.py --strict

echo "✅ Security scan completed. Check reports for issues."
```

#### Security Monitoring Script
```python
# scripts/security_monitor.py
import subprocess
import json
from datetime import datetime

class SecurityMonitor:
    def __init__(self):
        self.alerts = []
    
    def check_container_vulnerabilities(self):
        """Check for container vulnerabilities"""
        result = subprocess.run([
            'docker', 'run', '--rm', 
            '-v', '/var/run/docker.sock:/var/run/docker.sock',
            'aquasec/trivy', 'image', '--format', 'json',
            'portfolio-tracker-backend:latest'
        ], capture_output=True, text=True)
        
        if result.returncode == 0:
            vulnerabilities = json.loads(result.stdout)
            high_severity = [
                v for v in vulnerabilities.get('Results', [])
                if v.get('Severity') in ['HIGH', 'CRITICAL']
            ]
            
            if high_severity:
                self.alerts.append({
                    "type": "container_vulnerability",
                    "severity": "HIGH",
                    "count": len(high_severity),
                    "message": f"Found {len(high_severity)} high/critical vulnerabilities"
                })
    
    def check_rls_policies(self):
        """Validate RLS policies are active"""
        result = subprocess.run([
            'python', 'scripts/validate_rls_policies.py', '--json'
        ], capture_output=True, text=True)
        
        if result.returncode != 0:
            self.alerts.append({
                "type": "rls_policy_failure",
                "severity": "CRITICAL",
                "message": "RLS policy validation failed"
            })
    
    def check_ssl_certificates(self):
        """Check SSL certificate expiration"""
        # Implementation for SSL certificate monitoring
        pass
    
    def send_alerts(self):
        """Send security alerts"""
        if self.alerts:
            # Send to monitoring system
            print(f"🚨 {len(self.alerts)} security alerts detected")
            for alert in self.alerts:
                print(f"   - {alert['type']}: {alert['message']}")

if __name__ == "__main__":
    monitor = SecurityMonitor()
    monitor.check_container_vulnerabilities()
    monitor.check_rls_policies()
    monitor.check_ssl_certificates()
    monitor.send_alerts()
```

---

## Performance Optimization

### Bundle Analysis and Optimization

#### Frontend Bundle Analysis
```bash
# Analyze bundle size
npm run build
npx webpack-bundle-analyzer .next/static/chunks/*.js

# Bundle size monitoring
npm run build -- --analyze

# Performance audit
npx lighthouse http://localhost:3000 --output html --output-path ./reports/lighthouse-report.html

# Core Web Vitals monitoring
npx web-vitals-cli http://localhost:3000
```

#### Bundle Optimization Commands
```bash
# Pre-optimization analysis
npm run build
du -sh .next/static/chunks/* | sort -hr

# Optimize dependencies
npm-check-updates -u
npm install

# Remove unused dependencies
npx depcheck

# Analyze and remove unused CSS
npx purgecss --css .next/static/css/*.css --content .next/**/*.html .next/**/*.js

# Post-optimization verification
npm run build
npm run start
npx lighthouse http://localhost:3000 --only-categories=performance
```

### Database Performance Optimization

#### Index Analysis and Optimization
```sql
-- Identify missing indexes
SELECT 
    schemaname,
    tablename,
    seq_scan,
    seq_tup_read,
    seq_tup_read / seq_scan as avg_tup_read
FROM pg_stat_user_tables 
WHERE seq_scan > 0
ORDER BY seq_tup_read DESC
LIMIT 10;

-- Check index usage efficiency
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch,
    CASE WHEN idx_scan = 0 THEN 'UNUSED' ELSE 'USED' END as status
FROM pg_stat_user_indexes 
ORDER BY idx_scan ASC;

-- Query performance analysis
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM transactions 
WHERE user_id = 'specific-user-id' 
ORDER BY date DESC 
LIMIT 50;
```

#### Performance Monitoring Script
```python
# scripts/performance_monitor.py
import psycopg2
import time
import json
from datetime import datetime

class DatabasePerformanceMonitor:
    def __init__(self, connection_string):
        self.conn = psycopg2.connect(connection_string)
    
    def check_slow_queries(self, threshold_ms=1000):
        """Identify queries slower than threshold"""
        query = """
        SELECT 
            query,
            calls,
            total_time,
            mean_time,
            max_time
        FROM pg_stat_statements 
        WHERE mean_time > %s
        ORDER BY total_time DESC 
        LIMIT 10;
        """
        
        with self.conn.cursor() as cur:
            cur.execute(query, (threshold_ms,))
            return cur.fetchall()
    
    def check_table_sizes(self):
        """Monitor table growth"""
        query = """
        SELECT 
            schemaname,
            tablename,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
            pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
        FROM pg_tables 
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
        """
        
        with self.conn.cursor() as cur:
            cur.execute(query)
            return cur.fetchall()
    
    def generate_performance_report(self):
        """Generate comprehensive performance report"""
        report = {
            "timestamp": datetime.utcnow().isoformat(),
            "slow_queries": self.check_slow_queries(),
            "table_sizes": self.check_table_sizes(),
            "connection_stats": self.get_connection_stats()
        }
        
        with open(f"performance_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json", 'w') as f:
            json.dump(report, f, indent=2, default=str)
        
        return report
```

---

## Troubleshooting Procedures

### Common Issues and Solutions

#### Application Won't Start

**Issue**: Frontend or backend containers fail to start
```bash
# Diagnosis steps
docker-compose logs frontend
docker-compose logs backend

# Common solutions
docker-compose down
docker system prune -f
docker-compose build --no-cache
docker-compose up -d

# Environment variable check
python scripts/validate_environment.py
```

**Issue**: Database connection failures
```bash
# Check database connectivity
python -c "
import os
from supabase import create_client
client = create_client(os.getenv('SUPA_API_URL'), os.getenv('SUPA_API_ANON_KEY'))
print('Database connection successful')
"

# Verify environment variables
echo $SUPA_API_URL
echo $SUPA_API_ANON_KEY
```

#### Performance Issues

**Issue**: Slow page load times
```bash
# Frontend performance diagnosis
npm run build
npx lighthouse http://localhost:3000 --output json --output-path lighthouse-report.json

# Check bundle size
npx webpack-bundle-analyzer .next/static/chunks/*.js

# Backend performance diagnosis
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:8000/api/dashboard

# Database performance check
python scripts/performance_monitor.py --slow-queries --threshold 500
```

**Issue**: High memory usage
```bash
# Container resource usage
docker stats --no-stream

# Memory leak detection
node --inspect-brk=0.0.0.0:9229 .next/server.js &
chrome://inspect

# Backend memory profiling
pip install memory-profiler
python -m memory_profiler backend/main.py
```

#### Security Issues

**Issue**: RLS policy violations
```bash
# Validate RLS policies
python scripts/validate_rls_policies.py --fix-missing

# Test data isolation
python scripts/test_data_isolation.py --users 5

# Security audit
python scripts/security_audit.py --comprehensive
```

**Issue**: SSL/TLS certificate problems
```bash
# Check certificate validity
openssl x509 -in /etc/ssl/private/fullchain.pem -text -noout

# Test SSL configuration
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com

# Certificate renewal (Let's Encrypt)
certbot renew --dry-run
```

### Debug Mode Activation

#### Frontend Debug Mode
```bash
# Enable debug mode
export NEXT_PUBLIC_ENABLE_DEBUG=true
export NODE_ENV=development

# Start with debugging
npm run dev

# Enable React DevTools
npm install --save-dev @welldone-software/why-did-you-render
```

#### Backend Debug Mode
```bash
# Enable debug logging
export BACKEND_API_DEBUG=true
export DEBUG_INFO_LOGGING=true

# Start with debugging
uvicorn main:app --host 0.0.0.0 --port 8000 --reload --log-level debug

# Enable Python debugger
pip install pdb-attach
python -m pdb-attach main.py
```

### System Resource Monitoring

#### Resource Monitoring Script
```bash
#!/bin/bash
# scripts/monitor_resources.sh

echo "=== System Resource Monitor ==="
echo "Timestamp: $(date)"
echo

echo "=== Docker Container Stats ==="
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"
echo

echo "=== System Resources ==="
echo "CPU Usage: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print $1}')%"
echo "Memory Usage: $(free -m | awk 'NR==2{printf "%.1f%%", $3*100/$2}')"
echo "Disk Usage: $(df -h / | awk 'NR==2{print $5}')"
echo

echo "=== Network Connections ==="
netstat -an | grep :3000 | wc -l | xargs echo "Frontend connections:"
netstat -an | grep :8000 | wc -l | xargs echo "Backend connections:"
echo

echo "=== Recent Errors ==="
docker-compose logs --tail=5 frontend | grep -i error || echo "No frontend errors"
docker-compose logs --tail=5 backend | grep -i error || echo "No backend errors"
```

---

## Backup and Recovery

### Automated Backup Strategy

#### Complete System Backup
```bash
#!/bin/bash
# scripts/full_system_backup.sh

BACKUP_DIR="/backups/portfolio-tracker"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="full-backup-$DATE"

echo "Starting full system backup: $BACKUP_NAME"

# Create backup directory
mkdir -p "$BACKUP_DIR/$BACKUP_NAME"

# 1. Database backup
echo "Backing up database..."
pg_dump $DATABASE_URL > "$BACKUP_DIR/$BACKUP_NAME/database.sql"

# 2. Environment configuration backup
echo "Backing up configuration..."
cp .env.production "$BACKUP_DIR/$BACKUP_NAME/env-config.backup"

# 3. SSL certificates backup
echo "Backing up SSL certificates..."
cp -r /etc/ssl/private "$BACKUP_DIR/$BACKUP_NAME/ssl-certs"

# 4. Application logs backup
echo "Backing up logs..."
docker-compose logs > "$BACKUP_DIR/$BACKUP_NAME/application-logs.txt"

# 5. Docker images backup
echo "Backing up Docker images..."
docker save portfolio-tracker-frontend:latest | gzip > "$BACKUP_DIR/$BACKUP_NAME/frontend-image.tar.gz"
docker save portfolio-tracker-backend:latest | gzip > "$BACKUP_DIR/$BACKUP_NAME/backend-image.tar.gz"

# 6. Create backup metadata
cat > "$BACKUP_DIR/$BACKUP_NAME/backup-info.json" << EOF
{
  "backup_date": "$(date -Iseconds)",
  "backup_type": "full_system",
  "database_size": "$(du -sh $BACKUP_DIR/$BACKUP_NAME/database.sql | cut -f1)",
  "total_size": "$(du -sh $BACKUP_DIR/$BACKUP_NAME | cut -f1)",
  "git_commit": "$(git rev-parse HEAD)",
  "git_branch": "$(git branch --show-current)"
}
EOF

# 7. Compress backup
echo "Compressing backup..."
tar -czf "$BACKUP_DIR/$BACKUP_NAME.tar.gz" -C "$BACKUP_DIR" "$BACKUP_NAME"
rm -rf "$BACKUP_DIR/$BACKUP_NAME"

# 8. Upload to cloud storage (optional)
# aws s3 cp "$BACKUP_DIR/$BACKUP_NAME.tar.gz" s3://your-backup-bucket/

# 9. Verify backup integrity
if [ -f "$BACKUP_DIR/$BACKUP_NAME.tar.gz" ]; then
    echo "✅ Full system backup completed successfully"
    echo "   Backup file: $BACKUP_DIR/$BACKUP_NAME.tar.gz"
    echo "   Size: $(du -sh $BACKUP_DIR/$BACKUP_NAME.tar.gz | cut -f1)"
else
    echo "❌ Backup failed"
    exit 1
fi

# 10. Clean up old backups (keep last 7 days)
find "$BACKUP_DIR" -name "full-backup-*.tar.gz" -mtime +7 -delete
echo "✅ Old backups cleaned up"
```

### Disaster Recovery Procedures

#### Complete System Recovery
```bash
#!/bin/bash
# scripts/disaster_recovery.sh

BACKUP_FILE="$1"
RECOVERY_DIR="/tmp/portfolio-tracker-recovery"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup-file.tar.gz>"
    exit 1
fi

echo "Starting disaster recovery from: $BACKUP_FILE"

# 1. Extract backup
echo "Extracting backup..."
mkdir -p "$RECOVERY_DIR"
tar -xzf "$BACKUP_FILE" -C "$RECOVERY_DIR"

BACKUP_NAME=$(basename "$BACKUP_FILE" .tar.gz)
BACKUP_PATH="$RECOVERY_DIR/$BACKUP_NAME"

# 2. Verify backup integrity
if [ ! -f "$BACKUP_PATH/backup-info.json" ]; then
    echo "❌ Invalid backup file - missing metadata"
    exit 1
fi

echo "Backup info:"
cat "$BACKUP_PATH/backup-info.json"

# 3. Stop current services
echo "Stopping current services..."
docker-compose down

# 4. Restore database
echo "Restoring database..."
psql $DATABASE_URL < "$BACKUP_PATH/database.sql"

# 5. Restore configuration
echo "Restoring configuration..."
cp "$BACKUP_PATH/env-config.backup" .env.production

# 6. Restore SSL certificates
echo "Restoring SSL certificates..."
sudo cp -r "$BACKUP_PATH/ssl-certs" /etc/ssl/private

# 7. Load Docker images
echo "Loading Docker images..."
docker load < "$BACKUP_PATH/frontend-image.tar.gz"
docker load < "$BACKUP_PATH/backend-image.tar.gz"

# 8. Start services
echo "Starting services..."
docker-compose -f docker-compose.prod.yml up -d

# 9. Verify recovery
echo "Verifying recovery..."
sleep 30

# Check health endpoints
if curl -f http://localhost:8000/health > /dev/null 2>&1; then
    echo "✅ Backend health check passed"
else
    echo "❌ Backend health check failed"
fi

if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "✅ Frontend health check passed"
else
    echo "❌ Frontend health check failed"
fi

# 10. Validate data integrity
python scripts/validate_database_schema.py
python scripts/validate_rls_policies.py

echo "✅ Disaster recovery completed"
echo "   Services should be accessible at their normal endpoints"
echo "   Review logs for any issues: docker-compose logs"

# Cleanup
rm -rf "$RECOVERY_DIR"
```

### Backup Verification

#### Backup Testing Script
```bash
#!/bin/bash
# scripts/test_backup_recovery.sh

BACKUP_FILE="$1"
TEST_DIR="/tmp/backup-test-$(date +%s)"

echo "Testing backup recovery: $BACKUP_FILE"

# Create isolated test environment
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# Extract and test backup
tar -xzf "$BACKUP_FILE"
BACKUP_NAME=$(basename "$BACKUP_FILE" .tar.gz)

# Test database backup
echo "Testing database backup..."
if pg_restore --list "$BACKUP_NAME/database.sql" > /dev/null 2>&1; then
    echo "✅ Database backup is valid"
else
    echo "❌ Database backup is corrupted"
fi

# Test Docker images
echo "Testing Docker images..."
if docker load < "$BACKUP_NAME/frontend-image.tar.gz" > /dev/null 2>&1; then
    echo "✅ Frontend image backup is valid"
else
    echo "❌ Frontend image backup is corrupted"
fi

if docker load < "$BACKUP_NAME/backend-image.tar.gz" > /dev/null 2>&1; then
    echo "✅ Backend image backup is valid"
else
    echo "❌ Backend image backup is corrupted"
fi

# Cleanup
cd /
rm -rf "$TEST_DIR"

echo "✅ Backup verification completed"
```

---

## Maintenance Procedures

### Regular Maintenance Tasks

#### Daily Maintenance Checklist
```bash
#!/bin/bash
# scripts/daily_maintenance.sh

echo "=== Daily Maintenance Report - $(date) ==="

# 1. System health check
echo "1. System Health Check"
python scripts/health_check.py --comprehensive

# 2. Resource usage monitoring
echo "2. Resource Usage"
bash scripts/monitor_resources.sh

# 3. Security validation
echo "3. Security Validation"
python scripts/validate_rls_policies.py --silent
python scripts/detect_raw_sql.py --silent

# 4. Performance monitoring
echo "4. Performance Monitoring"
python scripts/performance_monitor.py --report

# 5. Backup verification
echo "5. Backup Status"
ls -la /backups/portfolio-tracker/ | tail -3

# 6. Log rotation
echo "6. Log Rotation"
docker-compose logs --tail=1000 > /var/log/portfolio-tracker-$(date +%Y%m%d).log

echo "=== Daily Maintenance Completed ==="
```

#### Weekly Maintenance Checklist
```bash
#!/bin/bash
# scripts/weekly_maintenance.sh

echo "=== Weekly Maintenance Report - $(date) ==="

# 1. Full security audit
echo "1. Security Audit"
python scripts/security_audit.py --full-scan

# 2. Performance optimization
echo "2. Performance Analysis"
python scripts/performance_monitor.py --analyze-trends --days 7

# 3. Database maintenance
echo "3. Database Maintenance"
psql $DATABASE_URL -c "VACUUM ANALYZE;"
psql $DATABASE_URL -c "REINDEX DATABASE portfolio_tracker;"

# 4. Dependency updates check
echo "4. Dependency Updates"
npm audit
pip-audit

# 5. Backup integrity test
echo "5. Backup Testing"
LATEST_BACKUP=$(ls -t /backups/portfolio-tracker/*.tar.gz | head -1)
bash scripts/test_backup_recovery.sh "$LATEST_BACKUP"

# 6. Certificate expiration check
echo "6. SSL Certificate Check"
openssl x509 -in /etc/ssl/private/fullchain.pem -noout -dates

echo "=== Weekly Maintenance Completed ==="
```

#### Monthly Maintenance Checklist
```bash
#!/bin/bash
# scripts/monthly_maintenance.sh

echo "=== Monthly Maintenance Report - $(date) ==="

# 1. Comprehensive system audit
echo "1. System Audit"
python scripts/system_audit.py --comprehensive

# 2. Performance baseline update
echo "2. Performance Baseline Update"
python scripts/update_performance_baseline.py

# 3. Security key rotation
echo "3. Security Key Rotation Check"
# Check key ages and plan rotation
python scripts/check_key_ages.py

# 4. Disaster recovery test
echo "4. Disaster Recovery Test"
# Test recovery procedure with test data
bash scripts/test_disaster_recovery.sh --dry-run

# 5. Dependency security audit
echo "5. Dependency Security Audit"
docker run --rm -v $(pwd):/project \
    aquasec/trivy filesystem --security-checks vuln,config /project

# 6. Cleanup and optimization
echo "6. System Cleanup"
docker system prune -f
docker volume prune -f

echo "=== Monthly Maintenance Completed ==="
```

### Automation Setup

#### Cron Job Configuration
```bash
# Add to crontab: crontab -e

# Daily maintenance at 2 AM
0 2 * * * /path/to/scripts/daily_maintenance.sh >> /var/log/maintenance.log 2>&1

# Weekly maintenance on Sundays at 3 AM
0 3 * * 0 /path/to/scripts/weekly_maintenance.sh >> /var/log/maintenance.log 2>&1

# Monthly maintenance on 1st of month at 4 AM
0 4 1 * * /path/to/scripts/monthly_maintenance.sh >> /var/log/maintenance.log 2>&1

# Hourly health checks
0 * * * * /path/to/scripts/health_check.py --brief >> /var/log/health.log 2>&1

# Quality monitoring every 5 minutes
*/5 * * * * python /path/to/scripts/quality_monitor.py --check-all --alert-on-failure
```

---

## Emergency Procedures

### Emergency Response Plan

#### Service Outage Response
```bash
#!/bin/bash
# scripts/emergency_response.sh

INCIDENT_TYPE="$1"
INCIDENT_ID="INC-$(date +%Y%m%d-%H%M%S)"

echo "🚨 EMERGENCY RESPONSE ACTIVATED"
echo "Incident ID: $INCIDENT_ID"
echo "Incident Type: $INCIDENT_TYPE"
echo "Timestamp: $(date)"

case "$INCIDENT_TYPE" in
    "service-down")
        echo "Executing service recovery..."
        docker-compose down
        docker-compose up -d
        sleep 30
        curl -f http://localhost:8000/health || echo "❌ Backend still down"
        curl -f http://localhost:3000/api/health || echo "❌ Frontend still down"
        ;;
    
    "database-issue")
        echo "Executing database recovery..."
        python scripts/validate_database_schema.py
        python scripts/validate_rls_policies.py --fix-missing
        ;;
    
    "security-breach")
        echo "🔒 SECURITY BREACH RESPONSE"
        # Immediately disable vulnerable features
        python scripts/emergency_disable_features.py --all-non-critical
        # Reset API keys
        python scripts/rotate_api_keys.py --emergency
        # Enable additional logging
        export DEBUG_INFO_LOGGING=true
        ;;
    
    "performance-degradation")
        echo "Executing performance recovery..."
        python scripts/performance_emergency.py --clear-caches --restart-services
        ;;
        
    *)
        echo "Unknown incident type: $INCIDENT_TYPE"
        echo "Available types: service-down, database-issue, security-breach, performance-degradation"
        exit 1
        ;;
esac

echo "Emergency response completed for $INCIDENT_ID"
echo "Next steps:"
echo "1. Monitor system status"
echo "2. Review logs: docker-compose logs"
echo "3. Update incident documentation"
echo "4. Conduct post-incident review"
```

---

This comprehensive deployment and operations guide provides all the necessary procedures for successfully deploying, monitoring, and maintaining the Portfolio Tracker system in production environments. Regular review and updates of these procedures ensure continued operational excellence.

**Document Version**: 2.1  
**Last Updated**: 2025-08-01  
**Next Review**: Quarterly  
**Status**: Production Ready