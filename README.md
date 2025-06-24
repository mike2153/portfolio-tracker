# Portfolio Tracker

A full-stack application consisting of a Django backend and a Next.js frontend. The project can be run locally or with Docker.

## Backend Setup

1. Navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Copy `env_example.txt` to `.env` and fill in your credentials. Required variables include:
   - `DATABASE_URL`
   - `DJANGO_SECRET_KEY`
   - `DEBUG`
   - `FINNHUB_API_KEY`
   - `ALPHA_VANTAGE_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_JWT_SECRET`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Install dependencies and run the server:
   ```bash
   pip install -r requirements.txt
   python manage.py runserver
   ```

## Frontend Setup

1. Navigate to the frontend folder:
   ```bash
   cd frontend
   ```
2. Create a `.env.local` file and set the following variables:
   - `NEXT_PUBLIC_API_BASE_URL`
   - `NEXT_PUBLIC_ENVIRONMENT`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_FINNHUB_API_KEY`
   - `ALPHA_VANTAGE_API_KEY`
3. Install dependencies and start the dev server:
   ```bash
   npm install
   npm run dev
   ```

## Docker Usage

To run both services with Docker, simply execute:
```bash
docker-compose up
```
The compose file already defines environment variables for the backend and frontend containers. Refer to [`backend/env_example.txt`](backend/env_example.txt) for the variables that need values.
