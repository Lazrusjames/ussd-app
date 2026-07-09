# USSD Power Management (Loadshedding) API

This project provides a USSD backend that lets mobile users check loadshedding schedules and recent power outage information. The app exposes a USSD webhook and a small set of HTTP APIs backed by Google Cloud Firestore as the single source of truth.

Key behaviours:
- Serve a multi-step USSD flow (via `POST /ussd`) implementing menus for Loadshedding and Power Outages.
- Store and read district and group outage schedules from Firestore (`districts` and `groups` collections).
- Seed Firestore with initial district/group data on first run (server boot or first request in serverless environments).
- Provide monitoring and admin operations:
  - `GET /districts` and `GET /groups` — read data from Firestore.
  - `GET /outages` and `GET /outages/:district` — query outage schedule data.
  - `GET /health` — simple health check reporting Firestore availability.
  - `POST /admin/refresh` — protected admin endpoint to refresh the in-memory cache from Firestore.

The app uses the Firebase Admin SDK to talk to Firestore; deployments must provide credentials (see Deployment section).

## Requirements

- Node.js 16+ (tested with Node 18+ / 22+)
- npm
- Firestore enabled in a Google Cloud project and a service account with permissions to read/write Firestore
- Environment variables: `FIREBASE_SERVICE_ACCOUNT` (recommended) and `ADMIN_SECRET` (optional, used to protect admin endpoints)

## Installation

1. Clone the repository and install dependencies:

```bash
git clone <repository-url>
cd ussd-app
npm install
```

2. Provide Firebase credentials for the Admin SDK. Recommended: set the full service account JSON into the `FIREBASE_SERVICE_ACCOUNT` environment variable (see Deployment section). Alternatively place `serviceAccountKey.json` in the project root only for local testing.

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
- On direct runs the app seeds Firestore (if empty) then starts the server.
- On serverless deployments (Vercel, Cloud Run) the app performs a request-time initialization to ensure Firestore is ready before serving API calls.

## API Endpoints

Main endpoints (examples):

- `POST /ussd` — USSD webhook (expects Africa's Talking style payload: `sessionId`, `serviceCode`, `phoneNumber`, `text`). Returns `CON` or `END` responses.
- `GET /districts` — return all districts (JSON) from Firestore.
- `GET /groups` — return all group schedules (JSON) from Firestore.
- `GET /outages` — summary of outages by district.
- `GET /outages/:district` — outages for a specific district.
- `GET /health` — status and Firestore availability.
- `POST /admin/refresh` — protected admin action; refreshes the in-memory cache from Firestore (requires `ADMIN_SECRET` header or body secret).

## Deployment (Vercel / Serverless)

Steps to deploy successfully on Vercel or other serverless platforms:

1. Enable the Cloud Firestore API for your Google Cloud project.
2. Create a service account with Firestore access (e.g. `roles/firestore.admin`) and obtain the JSON key.
3. On Vercel add the service account JSON as the environment variable `FIREBASE_SERVICE_ACCOUNT` (value is the raw JSON). Example with Vercel CLI:

```bash
vercel env add FIREBASE_SERVICE_ACCOUNT production
```

Paste the JSON when prompted and redeploy.

Notes:

- Ensure the service account has permissions to read/write Firestore.
- When running on GCP (Cloud Run, App Engine) you can rely on Application Default Credentials (ADC) instead of `FIREBASE_SERVICE_ACCOUNT`.

Health-check endpoint:

- `GET /health` — returns JSON indicating whether Firestore is available and initialized. Use this endpoint for deployment health checks.

## Support

If you need help:

- Verify Firestore API is enabled in the Google Cloud Console for your project.
- Check that `FIREBASE_SERVICE_ACCOUNT` contains valid JSON and the service account has Firestore access.
- Confirm `ADMIN_SECRET` is set if you plan to use `/admin/refresh`.

If you'd like, I can add an example script to call the admin refresh endpoint and provide automated deployment steps for Vercel.

