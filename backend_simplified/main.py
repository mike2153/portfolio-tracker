"""
Main FastAPI application entry point
Simplified architecture with clear route organization
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
import logging
from contextlib import asynccontextmanager
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from fastapi import FastAPI
from contextlib import asynccontextmanager
from services.dividend_service import dividend_service
from debug_logger import DebugLogger
import asyncio

# Import configuration
from config import (
    BACKEND_API_PORT, 
    BACKEND_API_HOST, 
    BACKEND_API_DEBUG,
    ALLOWED_ORIGINS,
    LOG_LEVEL
)

# Import debug logger
from debug_logger import DebugLogger

# Import routes
from backend_api_routes.backend_api_auth import auth_router
from backend_api_routes.backend_api_research import research_router
from backend_api_routes.backend_api_portfolio import portfolio_router
from backend_api_routes.backend_api_dashboard import dashboard_router
from backend_api_routes.backend_api_analytics import analytics_router

# Configure logging
logging.basicConfig(level=getattr(logging, LOG_LEVEL))
logger = logging.getLogger(__name__)

# Suppress noisy httpx logs
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
# Suppress APScheduler logs
logging.getLogger("apscheduler").setLevel(logging.WARNING)
# Suppress dividend service logs
logging.getLogger("services.dividend_service").setLevel(logging.WARNING)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    # Startup
    logger.info("""
========== APPLICATION STARTUP ==========
FILE: main.py
FUNCTION: lifespan
API: BACKEND
PORT: {BACKEND_API_PORT}
HOST: {BACKEND_API_HOST}
DEBUG: {BACKEND_API_DEBUG}
=========================================""")
    
    DebugLogger.info_if_enabled("[main.py::lifespan] Startup: Initiating immediate dividend sync for all users", logger)
    
    # Step 1: Sync global dividends from Alpha Vantage
    sync_result = await dividend_service.background_dividend_sync_all_users()
    if sync_result.get("success"):
        # logger.info(f"[main.py::lifespan] Successfully synced {sync_result.get('total_assigned', 0)} global dividends")
        pass
    else:
        logger.warning(f"[main.py::lifespan] Dividend sync had issues: {sync_result.get('error', 'Unknown error')}")
    
    # Step 2: Assign dividends to all users based on their holdings
    # This ensures users get dividends even if they were already in the global table
    # logger.info("[main.py::lifespan] Starting dividend assignment to users...")
    assignment_result = await dividend_service.assign_dividends_to_users_simple()
    if assignment_result.get("success"):
        # logger.info(f"[main.py::lifespan] Successfully assigned {assignment_result.get('total_assigned', 0)} dividends to users")
        pass
    else:
        logger.warning(f"[main.py::lifespan] Dividend assignment had issues: {assignment_result.get('error', 'Unknown error')}")
    
    DebugLogger.info_if_enabled("[main.py::lifespan] Startup sync and assignment completed", logger)
    
    loop = asyncio.get_event_loop()
    scheduler = AsyncIOScheduler(event_loop=loop)
    scheduler.add_job(
        dividend_service.background_dividend_sync_all_users,
        CronTrigger(hour=2, minute=0),
        id='daily_dividend_sync'
    )
    scheduler.start()
    DebugLogger.info_if_enabled("[main.py::lifespan] Scheduler started with event loop", logger)
    
    yield
    
    scheduler.shutdown()
    DebugLogger.info_if_enabled("[main.py::lifespan] Scheduler shutdown", logger)
    
    # Shutdown
    logger.info("""
========== APPLICATION SHUTDOWN ==========
FILE: main.py
FUNCTION: lifespan
API: BACKEND
==========================================""")

# Create FastAPI app
app = FastAPI(
    title="Portfolio Tracker API (Simplified)",
    description="Simplified backend for portfolio tracking with extensive debugging",
    version="2.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle all unhandled exceptions with detailed logging"""
    DebugLogger.log_error(
        file_name="main.py",
        function_name="global_exception_handler",
        error=exc,
        path=request.url.path,
        method=request.method
    )
    
    # Include CORS headers in error responses
    response = JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "message": str(exc),
            "path": request.url.path
        },
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*"
        }
    )
    
    return response

# Root endpoint
@app.get("/")
async def root():
    """Health check endpoint"""
    logger.info("[main.py::root] Health check requested")
    return {
        "status": "healthy",
        "service": "portfolio-tracker-backend",
        "version": "2.0.0"
    }

# Register routers with clear prefixes
app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])
app.include_router(research_router, prefix="/api", tags=["Research"])
app.include_router(portfolio_router, prefix="/api", tags=["Portfolio"])
app.include_router(dashboard_router, tags=["Dashboard"])  # No prefix - router already has /api prefix
app.include_router(analytics_router, prefix="/api/analytics", tags=["Analytics"])

# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all incoming requests"""
    logger.info(f"""
========== INCOMING REQUEST ==========
FILE: main.py
FUNCTION: log_requests
#METHOD: {request.method}
#PATH: {request.url.path}
#QUERY_PARAMS: {dict(request.query_params)}
#CLIENT: {request.client.host if request.client else 'Unknown'}
#=====================================""")
    
    response = await call_next(request)
    
    logger.info(f"""
========== OUTGOING RESPONSE ==========
FILE: main.py
FUNCTION: log_requests
STATUS_CODE: {response.status_code}
PATH: {request.url.path}
=======================================""")
    
    return response

if __name__ == "__main__":
    # Run the application
    logger.info(f"[main.py::__main__] Starting server on {BACKEND_API_HOST}:{BACKEND_API_PORT}")
    
    uvicorn.run(
        "main:app",
        host=BACKEND_API_HOST,
        port=BACKEND_API_PORT,
        reload=BACKEND_API_DEBUG,
        log_level=LOG_LEVEL.lower()
    ) 