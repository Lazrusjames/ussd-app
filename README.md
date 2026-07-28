# USSD Power Management (Loadshedding) API

This project provides a USSD backend that lets mobile users check loadshedding schedules and recent power outage information. The app exposes a USSD webhook and a small set of HTTP APIs backed by MongoDB as the primary persistence layer, with a safe in-memory fallback when no MongoDB URI is configured.

Key behaviours:
- Serve a multi-step USSD flow (via `POST /ussd`) implementing menus for Loadshedding and Power Outages.
- Store and read district and group outage schedules from MongoDB collections (`districts` and `groups`).
- Seed default district/group data on first run.
- Provide monitoring and admin operations:
  - `GET /districts` and `GET /groups` — read data from the active backend.
  - `GET /outages` and `GET /outages/:district` — query outage schedule data.
  - `GET /health` — simple health check reporting backend availability.
  - `POST /admin/refresh` — protected admin endpoint to refresh the in-memory cache from the active backend.

The app uses Mongoose to talk to MongoDB. If `MONGODB_URI` is absent, the app gracefully falls back to local in-memory data so tests and local development remain usable.

## Requirements

- Node.js 16+ (tested with Node 18+ / 22+)
- npm
- MongoDB instance reachable from the app
- Environment variables: `MONGODB_URI`, `MONGODB_DB` (optional), and `ADMIN_SECRET` (optional, used to protect admin endpoints)

## Installation

1. Clone the repository and install dependencies:

```bash
git clone <repository-url>
cd ussd-app
npm install
```

2. Copy `.env.example` to `.env` and configure your MongoDB connection details.

3. (Optional) Set an admin secret to protect the refresh endpoint:

```bash
export ADMIN_SECRET="someLongSecret"
```

## Running the Application

### Development

```bash
npm run dev
```

### Production / Direct Run

```bash
node app.js
```

Notes:
- On direct runs the app initializes the configured backend and seeds default records when needed.
- If MongoDB is not configured, the server still starts and serves the API using local in-memory fallback data.

## API Endpoints

Main endpoints (examples):

- `POST /ussd` — USSD webhook (expects Africa's Talking style payload: `sessionId`, `serviceCode`, `phoneNumber`, `text`). Returns `CON` or `END` responses.
- `GET /districts` — return all districts (JSON) from Firestore.
- `GET /groups` — return all group schedules (JSON) from Firestore.
- `GET /outages` — summary of outages by district.
- `GET /outages/:district` — outages for a specific district.
- `GET /health` — status and backend availability.
- `POST /admin/refresh` — protected admin action; refreshes the in-memory cache from the active backend (requires `ADMIN_SECRET` header or body secret).

## Deployment (Vercel / Serverless)

Steps to deploy successfully on Vercel or other serverless platforms:

1. Provision a MongoDB instance (Atlas or another managed MongoDB service).
2. Set the connection string in the deployment environment as `MONGODB_URI`.
3. Optionally set `MONGODB_DB` to the database name you want the app to use.
4. Set `ADMIN_SECRET` if you want to protect the admin refresh route.

Example:

```bash
vercel env add MONGODB_URI production
vercel env add MONGODB_DB production
vercel env add ADMIN_SECRET production
```

Health-check endpoint:

- `GET /health` — returns JSON indicating whether the MongoDB backend is available and initialized. Use this endpoint for deployment health checks.

## Support

If you need help:

- Verify `MONGODB_URI` is valid and the MongoDB user has read/write access.
- Confirm the MongoDB service is reachable from your deployment environment.
- Confirm `ADMIN_SECRET` is set if you plan to use `/admin/refresh`.

