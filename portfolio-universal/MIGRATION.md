# Portfolio Tracker - Expo Universal Migration Guide

## Overview
This document outlines the migration from Next.js web app to Expo universal app, supporting iOS, Android, and web from a single codebase.

## Migration Status

### ✅ Completed
1. **Project Setup**
   - Expo TypeScript project initialized
   - Core dependencies installed
   - NativeWind configured for Tailwind-style styling

2. **Shared Architecture**
   - `/shared` directory structure created
   - Business logic separated from UI
   - Cross-platform compatibility ensured

3. **Authentication**
   - Supabase client migrated with AsyncStorage
   - AuthProvider converted for React Native
   - Session persistence across platforms

4. **API Layer**
   - API client migrated with environment variable support
   - All endpoints preserved
   - Type safety maintained

5. **Data Layer**
   - All TypeScript types migrated
   - React Query hooks converted
   - Custom hooks updated for shared usage

6. **Charts**
   - Universal chart component created with Victory Native
   - ApexCharts functionality replicated
   - Loading states and animations included

7. **Navigation**
   - React Navigation configured
   - Bottom tabs for main sections
   - Stack navigation for detail screens

8. **Dashboard**
   - Main dashboard screen converted
   - KPI components migrated
   - Charts integrated

### 🚧 Pending
- Portfolio, Analytics, Research, Watchlist screens
- Transaction forms
- Testing setup
- CI/CD configuration

## Project Structure

```
portfolio-universal/
├── app/                      # Expo app structure
│   ├── navigation/          # Navigation configuration
│   ├── screens/            # Screen components
│   └── components/         # Screen-specific components
├── shared/                  # Shared business logic
│   ├── api/               # API clients and auth
│   ├── hooks/             # Data fetching hooks
│   ├── models/            # TypeScript types
│   ├── contexts/          # React contexts
│   └── utils/             # Utilities
├── components/             # Universal UI components
│   └── charts/           # Chart components
├── assets/                # Images and static assets
├── app.config.ts         # Expo configuration
├── tailwind.config.js    # Tailwind/NativeWind config
└── tsconfig.json         # TypeScript configuration
```

## Key Migration Patterns

### 1. HTML to React Native
```tsx
// Before (Next.js)
<div className="flex-1 bg-gray-900">
  <h1 className="text-2xl font-bold">Dashboard</h1>
  <button onClick={handleClick}>Click me</button>
</div>

// After (Expo)
<View className="flex-1 bg-gray-900">
  <Text className="text-2xl font-bold">Dashboard</Text>
  <TouchableOpacity onPress={handleClick}>
    <Text>Click me</Text>
  </TouchableOpacity>
</View>
```

### 2. Environment Variables
```tsx
// Before
process.env.NEXT_PUBLIC_SUPABASE_URL

// After
process.env.EXPO_PUBLIC_SUPABASE_URL
// or
Constants.expoConfig.extra.supabaseUrl
```

### 3. Navigation
```tsx
// Before (Next.js)
import { useRouter } from 'next/navigation';
const router = useRouter();
router.push('/dashboard');

// After (React Navigation)
import { useNavigation } from '@react-navigation/native';
const navigation = useNavigation();
navigation.navigate('Dashboard');
```

### 4. Charts
```tsx
// Before
<ApexChart type="area" data={data} />

// After
<UniversalChart type="area" data={data} />
```

## Running the App

### Prerequisites
1. Install dependencies:
   ```bash
   cd portfolio-universal
   npm install --legacy-peer-deps
   ```

2. Create `.env` file:
   ```
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   EXPO_PUBLIC_BACKEND_API_URL=your_backend_url
   ```

### Development
```bash
# Start Expo dev server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android

# Run on web
npm run web
```

## Deployment

### Web
```bash
npx expo export:web
# Deploy dist/ folder to hosting service
```

### Mobile (iOS/Android)
```bash
# Install EAS CLI
npm install -g eas-cli

# Configure EAS
eas build:configure

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android
```

### OTA Updates
```bash
eas update --branch production
```

## Testing

### Unit Tests
```bash
npm test
```

### E2E Tests
- iOS: Use Detox
- Android: Use Detox
- Web: Use Playwright

## Performance Considerations

1. **Image Optimization**
   - Use expo-image for optimized image loading
   - Implement lazy loading for lists

2. **Chart Performance**
   - Victory Native is optimized for mobile
   - Consider data decimation for large datasets

3. **Navigation**
   - Use React.memo for screen components
   - Implement proper list virtualization

## Troubleshooting

### Common Issues

1. **Metro bundler issues**
   ```bash
   npx expo start --clear
   ```

2. **Type errors**
   - Ensure all @types packages are installed
   - Check tsconfig.json path mappings

3. **Native module linking**
   ```bash
   npx expo prebuild --clean
   ```

## Next Steps

1. Complete remaining screen migrations
2. Implement push notifications
3. Add offline support with AsyncStorage
4. Set up CI/CD with EAS Build
5. Configure crash reporting
6. Implement deep linking

## Resources

- [Expo Documentation](https://docs.expo.dev)
- [React Navigation](https://reactnavigation.org)
- [NativeWind](https://www.nativewind.dev)
- [Victory Native](https://formidable.com/open-source/victory/docs/native)
- [Supabase React Native](https://supabase.com/docs/guides/getting-started/tutorials/with-react-native)