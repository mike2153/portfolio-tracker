# Portfolio Tracker

This project combines a Django backend with a Next.js frontend. Development and
local testing are done using Docker Compose.

## Setup

1. Copy `.env.example` to `.env` and fill in your own secret values.
2. Run `docker-compose up --build` to start both services.

### Required Environment Variables

Docker Compose reads the following variables from the `.env` file or your CI
secrets:

- `DJANGO_SECRET_KEY`
- `SUPABASE_JWT_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`

These values are injected into the backend container and should match the
settings from your Supabase project and Django configuration.
