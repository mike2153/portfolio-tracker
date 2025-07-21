# Shared Module

This directory contains shared code between the Next.js frontend and the Expo mobile app.

## Structure

- `api/` - API client code for backend communication
  - `front_api_client.ts` - Main API client with all endpoint methods
  - `index.ts` - Barrel export

- `types/` - Shared TypeScript type definitions
  - `api.ts` - API response and data types
  - `index.ts` - Barrel export

- `utils/` - Shared utility functions
  - `supabaseClient.ts` - Supabase client configuration
  - `logger.ts` - Cross-platform logging utility
  - `index.ts` - Barrel export

## Environment Variables

The shared code supports both Next.js and Expo environment variables:

- Next.js: `NEXT_PUBLIC_*`
- Expo: `EXPO_PUBLIC_*`

Required variables:
- `NEXT_PUBLIC_BACKEND_API_URL` / `EXPO_PUBLIC_BACKEND_API_URL`
- `NEXT_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## Usage

Import from the shared module in your Next.js or Expo app:

```typescript
// Import API client
import { front_api_client } from '../shared/api';

// Import types
import { ApiResponse, DashboardOverview } from '../shared/types';

// Import utilities
import { supabase, logger } from '../shared/utils';
```