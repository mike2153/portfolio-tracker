#!/bin/sh
# Restart all Docker Compose services for the project

echo "Stopping all services..."
docker-compose down

echo "Rebuilding and starting all services..."
docker-compose up --build 