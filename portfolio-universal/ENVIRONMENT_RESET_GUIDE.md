# Environment Reset Guide - Fix "Cannot read property 'S' of undefined"

## Issue Confirmed
The error persists even with a minimal React Native app, confirming this is an **environment/installation corruption issue**, not a code problem.

## Nuclear Environment Reset (Windows)

### Step 1: Complete Node.js Reset
```bash
# Uninstall Node.js completely
# Go to Control Panel > Programs > Uninstall Node.js

# Clear npm cache globally
npm cache clean --force

# Remove npm global directory
rmdir /s /q "%APPDATA%\npm"

# Remove npm-cache
rmdir /s /q "%APPDATA%\npm-cache"
```

### Step 2: Download Fresh Node.js
- Download Node.js LTS from https://nodejs.org (currently 18.x or 20.x)
- Install with default settings
- Restart computer after installation

### Step 3: Global Package Reset
```bash
# Verify Node.js installation
node --version
npm --version

# Install Expo CLI fresh
npm install -g @expo/cli@latest

# Clear any remaining cache
npm cache clean --force
```

### Step 4: Windows Environment Variables
```bash
# Check these environment variables:
echo %NODE_ENV%
echo %PATH%

# Should include Node.js paths like:
# C:\Program Files\nodejs\
```

### Step 5: Project Reset
```bash
# In your project directory:
rmdir /s /q node_modules
rmdir /s /q .expo
del package-lock.json
del yarn.lock

# Fresh install
npm install

# Start clean
npx expo start --clear
```

## Alternative: Expo Dev Build
If environment reset doesn't work, try Expo Dev Build:

```bash
# Install EAS CLI
npm install -g eas-cli

# Create development build
eas build --profile development --platform ios
```

## Last Resort: Different Development Environment
1. **WSL2 Ubuntu**: Install Ubuntu in WSL2 and develop there
2. **Expo Snack**: Use https://snack.expo.dev for online development
3. **CodeSandbox**: Use online React Native environment

## Root Cause Analysis
The "Cannot read property 'S' of undefined" in Hermes with minimal apps indicates:
- Corrupted Node.js/npm installation
- Broken Metro bundler cache that won't clear
- Windows environment variable conflicts
- Expo CLI corruption

This is NOT a code issue - it's a development environment corruption.