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

# Configure logging
logging.basicConfig(level=getattr(logging, LOG_LEVEL))
logger = logging.getLogger(__name__)

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
    
    yield
    
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
    
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "message": str(exc),
            "path": request.url.path
        }
    )

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
app.include_router(dashboard_router, prefix="/api", tags=["Dashboard"])

# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all incoming requests"""
    logger.info(f"""
========== INCOMING REQUEST ==========
FILE: main.py
FUNCTION: log_requests
METHOD: {request.method}
PATH: {request.url.path}
QUERY_PARAMS: {dict(request.query_params)}
CLIENT: {request.client.host if request.client else 'Unknown'}
=====================================""")
    
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