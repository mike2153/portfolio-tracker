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
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
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

# Import debug logger (already imported above)

# Import routes
from backend_api_routes.backend_api_auth import auth_router
from backend_api_routes.backend_api_research import research_router
from backend_api_routes.backend_api_portfolio import portfolio_router
from backend_api_routes.backend_api_dashboard import dashboard_router
from backend_api_routes.backend_api_analytics import analytics_router
from backend_api_routes.backend_api_watchlist import watchlist_router
from backend_api_routes.backend_api_user_profile import user_profile_router
from backend_api_routes.backend_api_forex import forex_router

# Import exception handler registration
from middleware.error_handler import register_exception_handlers

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
    
    loop = asyncio.get_running_loop()
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
    logger.info(f"""
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

# Register exception handlers
register_exception_handlers(app)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Note: Global exception handling is now managed by middleware.error_handler.register_exception_handlers()

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
app.include_router(watchlist_router, tags=["Watchlist"])  # No prefix - router already has /api/watchlist prefix
app.include_router(user_profile_router, prefix="/api", tags=["User Profile"])
app.include_router(forex_router, prefix="/api", tags=["Forex"])

# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all incoming requests"""
    #DebugLogger.info_if_enabled(f"[main.py::log_requests] Incoming request: {request.method} {request.url.path}", logger)
    response = await call_next(request)
   # DebugLogger.info_if_enabled(f"[main.py::log_requests] Outgoing response: {response.status_code} {request.url.path}", logger)
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