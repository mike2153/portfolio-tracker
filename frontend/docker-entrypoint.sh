#!/bin/sh

# Build the shared module if needed
if [ -d "/shared" ]; then
  echo "Building shared module..."
  cd /shared
  # Install dependencies if needed
  if [ ! -d "node_modules" ]; then
    npm install
  fi
  # Build the module
  npm run build
  cd /app
fi

# Start the development server
exec npm run dev -- --hostname 0.0.0.0