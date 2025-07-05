# 🔥 Docker Hot Reload Setup

This document explains how to use the Docker development environment with hot reload enabled for both frontend and backend.

## 🚀 Quick Start

### Windows
```bash
# Run the development script
docker-dev.bat
```

### Linux/Mac
```bash
# Run the development script
./docker-dev.sh
```

### Manual Start
```bash
# Build and start with hot reload
docker-compose up --build

# Or in detached mode
docker-compose up --build -d
```

## 🔧 What's Configured

### Frontend Hot Reload
- **Volume Mounting**: Source code is mounted as a volume (`./frontend:/app`)
- **Node Modules Protection**: Prevents overwriting installed packages
- **Next.js Configuration**: Optimized for Docker file watching
- **Environment Variables**: 
  - `WATCHPACK_POLLING=true` - Enables polling for file changes
  - `CHOKIDAR_USEPOLLING=true` - Enables chokidar polling
- **Webpack Configuration**: Custom polling settings for Docker

### Backend Hot Reload
- **Volume Mounting**: Source code is mounted as a volume (`./backend_simplified:/app`)
- **Uvicorn Reload**: `--reload` flag enables automatic reloading
- **File Watching**: Monitors Python files for changes

## 📁 Volume Mounts

```yaml
frontend:
  volumes:
    - ./frontend:/app              # Mount source code
    - /app/node_modules           # Protect node_modules
    - /app/.next                  # Protect Next.js cache

backend:
  volumes:
    - ./backend_simplified:/app   # Mount source code
```

## 🔍 How It Works

### Frontend
1. **File Change Detection**: Next.js watches for file changes using polling
2. **Fast Refresh**: React Fast Refresh provides instant updates
3. **Asset Reloading**: CSS, JS, and other assets update automatically
4. **State Preservation**: Component state is preserved during updates

### Backend
1. **Python File Watching**: Uvicorn monitors `.py` files
2. **Automatic Restart**: Server restarts when files change
3. **API Endpoint Updates**: New routes and changes are reflected immediately

## 🛠️ Development Workflow

1. **Start Development Environment**:
   ```bash
   docker-compose up --build
   ```

2. **Make Changes**:
   - Edit frontend files in `./frontend/`
   - Edit backend files in `./backend_simplified/`

3. **See Changes Instantly**:
   - Frontend: Changes appear in browser automatically
   - Backend: API server restarts and updates endpoints

4. **Stop Environment**:
   ```bash
   docker-compose down
   ```

## 🔧 Troubleshooting

### Hot Reload Not Working?

1. **Check Volume Mounts**:
   ```bash
   docker-compose ps
   docker exec -it frontend ls -la /app
   ```

2. **Verify Environment Variables**:
   ```bash
   docker exec -it frontend env | grep WATCH
   ```

3. **Check File Permissions** (Linux/Mac):
   ```bash
   ls -la frontend/
   ```

4. **Restart Containers**:
   ```bash
   docker-compose down
   docker-compose up --build
   ```

### Common Issues

- **Node Modules Issues**: Delete `node_modules` and rebuild
- **Port Conflicts**: Ensure ports 3000 and 8000 are available
- **File Watching**: On Windows, ensure Docker has access to the drive

## 🎯 Performance Tips

1. **Use .dockerignore**: Exclude unnecessary files
2. **Optimize Polling**: Adjust polling intervals if needed
3. **Resource Limits**: Set appropriate memory/CPU limits
4. **Dependency Caching**: Layer Docker builds efficiently

## 📝 Configuration Files

### docker-compose.yml
- Volume mounts for source code
- Environment variables for hot reload
- Port mappings

### frontend/Dockerfile
- Development-optimized build
- Hot reload command configuration

### frontend/next.config.js
- Webpack polling configuration
- Docker-specific optimizations

## 🌐 Access Points

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs
- **API Redoc**: http://localhost:8000/redoc

## 🔥 Hot Reload Features

✅ **Frontend Hot Reload**: React Fast Refresh  
✅ **Backend Hot Reload**: Uvicorn auto-restart  
✅ **CSS Hot Reload**: Instant style updates  
✅ **API Hot Reload**: Automatic endpoint updates  
✅ **State Preservation**: Component state maintained  
✅ **Error Overlay**: Development error display  

## 📚 Additional Resources

- [Next.js Fast Refresh](https://nextjs.org/docs/basic-features/fast-refresh)
- [Uvicorn Auto-reload](https://www.uvicorn.org/#command-line-options)
- [Docker Compose Volumes](https://docs.docker.com/compose/compose-file/compose-file-v3/#volumes) 