# Update Log - Portfolio Tracker

## Date: 2025-07-21

### Issue: iOS App Hermes Engine Error - "Cannot read property 'S' of undefined"

#### Problem Description
- Portfolio Tracker React Native/Expo app failing to run on iOS
- Hermes engine throwing "Cannot read property 'S' of undefined" error
- Error occurred even with minimal React components
- App would bundle successfully but crash immediately on device

#### Initial Troubleshooting (Failed Attempts)
1. **TypeScript Config Changes** - Modified `noImplicitThis` setting
2. **PropTypes Polyfill** - Added `prop-types` package thinking it was React 19 compatibility issue
3. **Environment Reset** - Cleared node_modules, package-lock.json, and caches
4. **Metro Config Changes** - Updated resolver settings
5. **React Version Downgrades** - Attempted to use React 18 instead of 19

#### Root Cause Analysis
The error was **NOT** related to:
- PropTypes removal in React 19
- Environment corruption
- TypeScript configuration
- Metro bundler cache issues

#### Actual Root Cause: Missing Babel Runtime Helpers
- **Missing Dependency**: `@babel/runtime` package was not properly installed
- **Hermes Error**: When transpiled code tried to access Babel helper functions, they returned `undefined`
- **Cryptic Error Message**: "Cannot read property 'S' of undefined" was actually code trying to access properties on missing Babel helper modules
- **Helper Function**: Specifically missing `arrayLikeToArray.js` and related iterator helpers

#### Solution
```bash
cd portfolio-universal
npm install @babel/runtime@latest --legacy-peer-deps
npx expo start --clear
```

#### Technical Details
- **Added Package**: `@babel/runtime@7.27.6`
- **Helper Functions**: Provides transpilation helpers for modern JavaScript features
- **Compatibility**: Required for React Native 0.79.5 + React 19.0.0 combination
- **Error Resolution**: Babel helpers now available, eliminating undefined module access

#### Key Learnings
1. **Misleading Error Messages**: Hermes engine errors can be cryptic and point to wrong causes
2. **Babel Dependencies**: Modern React Native projects require explicit `@babel/runtime` installation
3. **Debugging Strategy**: Check for missing core dependencies before assuming environment issues
4. **Version Compatibility**: React Native 0.79+ with React 19 has specific Babel requirements

#### Prevention
- Always include `@babel/runtime` in dependencies for React Native projects
- Use `npx expo install --fix` to ensure version compatibility
- Test with minimal components first to isolate dependency vs code issues

#### Status: ✅ RESOLVED
iOS app now runs successfully on physical iPhone via Expo Go.

---

### Development Environment
- **Node.js**: v22.17.1
- **npm**: 10.9.2
- **Expo SDK**: 53.0.20
- **React**: 19.0.0
- **React Native**: 0.79.5
- **Platform**: Windows 11, iOS device testing

### Next Steps
- Gradually add back complex components and navigation
- Test full portfolio tracker functionality on iOS
- Consider creating a development build for advanced features