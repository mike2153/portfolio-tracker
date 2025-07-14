@echo off
REM 🔥 Portfolio Tracker - Docker Development Script (Windows)
REM This script starts the development environment with hot reload enabled

echo 🚀 Starting Portfolio Tracker Development Environment...
echo 🔥 Hot reload is enabled for both frontend and backend
echo.

REM Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not running. Please start Docker first.
    pause
    exit /b 1
)

REM Stop any existing containers
echo 🛑 Stopping existing containers...
docker-compose down

REM Build and start containers
echo 🏗️  Building and starting containers...
docker-compose up --build

echo.
echo ✅ Development environment started!
echo 🌐 Frontend: http://localhost:3000
echo 🔌 Backend API: http://localhost:8000
echo 📚 API Docs: http://localhost:8000/docs
echo.
echo 🔥 Hot reload is active - your changes will be reflected automatically!
echo 📝 To stop: Press Ctrl+C or run 'docker-compose down'
pause 