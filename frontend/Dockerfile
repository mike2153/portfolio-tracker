# frontend/Dockerfile - Development optimized
FROM node:18-alpine

WORKDIR /app

# Install dependencies for better file watching in Docker
RUN apk add --no-cache libc6-compat

# Clean previous build artifacts and dependencies
RUN rm -rf node_modules package-lock.json

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy source code (this will be overridden by volume mount in development)
COPY . .

# Expose port for Next.js development server
EXPOSE 3000

# 🔥 Start Next.js development server with hot reload
# The --hostname 0.0.0.0 ensures the server accepts connections from outside the container
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0"] 