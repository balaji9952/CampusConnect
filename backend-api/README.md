# Backend API

This is the Node.js / Express backend for Campus Connect. It serves the REST API consumed by the Flutter app and web portals.

## Prerequisites
- Node.js (v18+)
- PostgreSQL (via Supabase)

## Installation
```bash
cd backend-api
npm install
```

## Environment Configuration
1. Copy `.env.example` to `.env`
2. Fill in the secrets, especially `DATABASE_URL` and `JWT_SECRET`.
3. Provide the Firebase Admin service account key in `firebase-service-account.json`.

## Database Setup
Run the Prisma migrations or push the schema to sync your database:
```bash
npx prisma db push
```

## Running the Server
**Development (with Hot Reload):**
```bash
npm run dev
```

**Production Build:**
```bash
npm run build
npm start
```

## Scripts
Standalone scripts for seeding data, fixing database entries, and performance testing can be found in the `scripts/` folder. They can be executed using `npx tsx` or `node`.
