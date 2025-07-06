#!/bin/bash

# 🔥 Portfolio Tracker - Docker Development Script
# This script starts the development environment with hot reload enabled

echo "🚀 Starting Portfolio Tracker Development Environment..."
echo "🔥 Hot reload is enabled for both frontend and backend"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Stop any existing containers
echo "🛑 Stopping existing containers..."
docker-compose down

# Build and start containers
echo "🏗️  Building and starting containers..."
docker-compose up --build

echo ""
echo "✅ Development environment started!"
echo "🌐 Frontend: http://localhost:3000"
echo "🔌 Backend API: http://localhost:8000"
echo "📚 API Docs: http://localhost:8000/docs"
echo ""
echo "🔥 Hot reload is active - your changes will be reflected automatically!"
echo "📝 To stop: Press Ctrl+C or run 'docker-compose down'" 