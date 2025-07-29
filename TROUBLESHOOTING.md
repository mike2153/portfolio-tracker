# Troubleshooting Frontend API Errors

## Current Issue: HTTPException on Watchlist API

### Quick Diagnostics

1. **Check if Backend is Running:**
   ```bash
   # Check Docker containers
   cd backend_simplified
   docker-compose ps
   
   # Check logs
   docker-compose logs -f --tail=50
   ```

2. **Test Backend Directly:**
   ```bash
   # Test health endpoint
   curl http://localhost:8000/health
   
   # Test watchlist endpoint (will fail without auth, but shows if backend is up)
   curl http://localhost:8000/api/watchlist
   ```

3. **Check Browser Console:**
   - Open browser DevTools (F12)
   - Look for more detailed error messages
   - Check Network tab for failed requests
   - Look for CORS errors or 401/403 status codes

### Common Fixes

#### Backend Not Running
```bash
cd backend_simplified
docker-compose down
docker-compose up -d --build
```

#### Authentication Issues
1. Log out and log back in
2. Clear browser localStorage
3. Check Supabase dashboard for user status

#### Port Conflicts
```bash
# Windows
netstat -an | findstr :8000

# Mac/Linux  
lsof -i :8000
```

### Debug Steps

1. **Enable Detailed Logging:**
   - Backend: Set `LOG_LEVEL=DEBUG` in .env
   - Frontend: Check browser console for error details

2. **Check API Version:**
   - Frontend is using v1 by default
   - Backend supports both v1 and v2
   - No version mismatch issues

3. **Verify Environment Variables:**
   ```bash
   # Backend
   cat backend_simplified/.env | grep -E "(SUPA_API|BACKEND_API)"
   
   # Frontend
   cat frontend/.env.local | grep NEXT_PUBLIC_BACKEND_API_URL
   ```

### API Response Formats

The watchlist endpoint returns:
```json
// v1 (default)
{
  "success": true,
  "watchlist": [...],
  "count": 5
}

// v2 (with X-API-Version: v2 header)
{
  "success": true,
  "data": {
    "watchlist": [...],
    "count": 5
  },
  "metadata": {...}
}
```

### If Nothing Works

1. **Restart Everything:**
   ```bash
   # Stop all
   cd backend_simplified && docker-compose down
   cd ../frontend && npm run dev:stop
   
   # Start backend
   cd ../backend_simplified && docker-compose up -d
   
   # Start frontend
   cd ../frontend && npm run dev
   ```

2. **Check Recent Changes:**
   - All imports have been fixed
   - API versioning has been added
   - Response formats are backward compatible

3. **Test with curl:**
   ```bash
   # Get a token from browser localStorage (supabase.auth.token)
   curl -H "Authorization: Bearer YOUR_TOKEN_HERE" \
        http://localhost:8000/api/watchlist
   ```