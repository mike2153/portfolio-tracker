"""
Configuration for the simplified portfolio tracker backend
All environment variables and settings in one place
"""
import os
from dotenv import load_dotenv
from typing import Optional

# Load environment variables
load_dotenv()

# API Keys and URLs
SUPA_API_URL = os.getenv("SUPA_API_URL", "")
SUPA_API_ANON_KEY = os.getenv("SUPA_API_ANON_KEY", "")
SUPA_API_SERVICE_KEY = os.getenv("SUPA_API_SERVICE_KEY", "")

VANTAGE_API_KEY = os.getenv("VANTAGE_API_KEY", "")
VANTAGE_API_BASE_URL = os.getenv("VANTAGE_API_BASE_URL", "https://www.alphavantage.co/query")

# Backend Settings
BACKEND_API_PORT = int(os.getenv("BACKEND_API_PORT", "8000"))
BACKEND_API_HOST = os.getenv("BACKEND_API_HOST", "0.0.0.0")
BACKEND_API_DEBUG = os.getenv("BACKEND_API_DEBUG", "True").lower() == "true"

# CORS Settings
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
ALLOWED_ORIGINS = [
    FRONTEND_URL,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

# Cache Settings
CACHE_TTL_SECONDS = int(os.getenv("CACHE_TTL_SECONDS", "3600"))  # 1 hour default

# Logging
LOG_LEVEL = os.getenv("LOG_LEVEL", "WARNING")
LOG_FORMAT = "[%(asctime)s] [%(name)s] [%(levelname)s] %(message)s"

# Rate Limiting
RATE_LIMIT_PER_MINUTE = int(os.getenv("RATE_LIMIT_PER_MINUTE", "60"))

# Debug logging control
DEBUG_INFO_LOGGING = os.getenv('DEBUG_INFO_LOGGING', 'false').lower() == 'true'

# Validate required environment variables
required_vars = [
    "SUPA_API_URL",
    "SUPA_API_ANON_KEY",
    "VANTAGE_API_KEY"
]

missing_vars = [var for var in required_vars if not os.getenv(var)]
if missing_vars:
    raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")

print(f"[config.py::init] Configuration loaded successfully")
print(f"[config.py::init] SUPA_API_URL: {SUPA_API_URL}")
print(f"[config.py::init] BACKEND_API_PORT: {BACKEND_API_PORT}")
print(f"[config.py::init] LOG_LEVEL: {LOG_LEVEL}") 