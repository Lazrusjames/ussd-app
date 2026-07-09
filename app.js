import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createApiRouter } from './api/index.js';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
let serviceAccount = null;

// Support providing the service account JSON via environment variable (recommended for deployments)
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } catch (err) {
    console.error('Invalid FIREBASE_SERVICE_ACCOUNT JSON:', err.message);
  }
} else {
  // Fallback to local file if present
  try {
    if (fs.existsSync(serviceAccountPath)) {
      serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    }
  } catch (err) {
    console.error('Failed to read local serviceAccountKey.json:', err.message);
  }
}

let db = null;

try {
  let adminApp;
  if (serviceAccount) {
    adminApp = getApps().length ? getApps()[0] : initializeApp({
      credential: cert(serviceAccount)
    });
  } else {
    // Try initialize with default credentials (useful when running inside GCP)
    adminApp = getApps().length ? getApps()[0] : initializeApp();
  }
  db = getFirestore(adminApp);
} catch (error) {
  console.warn('Firebase Admin initialization failed; Firestore unavailable:', error.message);
}

const DISTRICTS_COLLECTION = 'districts';
const GROUPS_COLLECTION = 'groups';

const DEFAULT_DISTRICTS = {
  1: {
    id: '1',
    name: 'Lilongwe',
    region: 'Central',
    group: 'A',
    outageSchedule: ['Monday 2-4 PM', 'Wednesday 6-8 PM'],
    averageDuration: '2 hours'
  },
  2: {
    id: '2',
    name: 'Blantyre',
    region: 'Southern',
    group: 'B',
    outageSchedule: ['Tuesday 2-4 PM', 'Thursday 6-8 PM'],
    averageDuration: '2.5 hours'
  },
  3: {
    id: '3',
    name: 'Zomba',
    region: 'Southern',
    group: 'C',
    outageSchedule: ['Wednesday 2-4 PM', 'Friday 6-8 PM'],
    averageDuration: '2 hours'
  },
  4: {
    id: '4',
    name: 'Mzuzu',
    region: 'Northern',
    group: 'D',
    outageSchedule: ['Thursday 2-4 PM', 'Saturday 6-8 PM'],
    averageDuration: '1.5 hours'
  }
};

const DEFAULT_GROUPS = {
  A: {
    group: 'A',
    schedule: ['Monday 2-4 PM', 'Wednesday 6-8 PM'],
    description: 'Group A Loadshedding Schedule'
  },
  B: {
    group: 'B',
    schedule: ['Tuesday 2-4 PM', 'Thursday 6-8 PM'],
    description: 'Group B Loadshedding Schedule'
  },
  C: {
    group: 'C',
    schedule: ['Wednesday 2-4 PM', 'Friday 6-8 PM'],
    description: 'Group C Loadshedding Schedule'
  },
  D: {
    group: 'D',
    schedule: ['Thursday 2-4 PM', 'Saturday 6-8 PM'],
    description: 'Group D Loadshedding Schedule'
  }
};

// Global references that will hold our runtime data
let DISTRICTS = {};
let GROUPS = {};

const getCollectionData = async (collectionName) => {
    if (!db) {
        throw new Error('Firestore is not initialized');
    }

    const snapshot = await db.collection(collectionName).get();
    const data = {};
    snapshot.forEach((doc) => {
        data[doc.id] = doc.data();
    });
    return data;
};

const writeCollectionData = async (collectionName, data) => {
    if (!db) {
        throw new Error('Firestore is not initialized');
    }

    const batch = db.batch();
    for (const [id, value] of Object.entries(data)) {
        const ref = db.collection(collectionName).doc(id.toString());
        batch.set(ref, value);
    }
    await batch.commit();
};

const seedCollectionsIfEmpty = async () => {
    if (!db) {
        throw new Error('Firestore is not initialized');
    }

    const districtsSnapshot = await db.collection(DISTRICTS_COLLECTION).limit(1).get();
    if (districtsSnapshot.empty) {
        await writeCollectionData(DISTRICTS_COLLECTION, DEFAULT_DISTRICTS);
    }

    const groupsSnapshot = await db.collection(GROUPS_COLLECTION).limit(1).get();
    if (groupsSnapshot.empty) {
        await writeCollectionData(GROUPS_COLLECTION, DEFAULT_GROUPS);
    }
};

const refreshFirebaseData = async () => {
    const [districts, groups] = await Promise.all([
        getCollectionData(DISTRICTS_COLLECTION),
        getCollectionData(GROUPS_COLLECTION)
    ]);

    DISTRICTS = districts;
    GROUPS = groups;
};

// --- THIS RUNS ONLY ONCE AT SERVER BOOT ---
const bootUpDatabase = async () => {
    if (!db) {
        throw new Error('Firestore is not initialized');
    }

    await seedCollectionsIfEmpty();
    await refreshFirebaseData();
    console.log('Firebase Database connected and synced successfully.');
};

// Standard Express setup
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- REMOVED THE ASYNC MIDWLEWARE FROM HERE ---

// Session management
const sessionStore = {};
const saveSession = (sessionId, data) => {
    sessionStore[sessionId] = { ...sessionStore[sessionId], ...data };
};
const getSession = (sessionId) => sessionStore[sessionId] || {};
const clearSession = (sessionId) => { delete sessionStore[sessionId]; };

// Ensure Firestore data is initialized on serverless environments (e.g. Vercel)
let _firestoreInitialized = false;
app.use(async (req, res, next) => {
  if (!db) return next();
  if (!_firestoreInitialized) {
    try {
      await bootUpDatabase();
      _firestoreInitialized = true;
    } catch (err) {
      console.error('Failed to initialize Firestore on request:', err.message);
      return next();
    }
  }
  next();
});

// Router setups function smoothly because variables are updated globally
app.use(createApiRouter({
  getDistricts: () => DISTRICTS,
  getGroups: () => GROUPS,
  getSession,
  saveSession,
  clearSession
}));

// Health check endpoint for deployments and monitoring
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    firestoreAvailable: !!db,
    firestoreInitialized: !!_firestoreInitialized
  });
});

// Per-request data-source header and simple logging
app.use((req, res, next) => {
  const dataSource = (db && _firestoreInitialized) ? 'firestore' : 'unavailable';
  res.set('X-Data-Source', dataSource);
  console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl} dataSource=${dataSource}`);
  next();
});

// Admin endpoint to refresh Firestore cache (protected by ADMIN_SECRET env var)
app.post('/admin/refresh', async (req, res) => {
  const secret = req.headers['x-admin-secret'] || req.body?.secret;
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!db) {
    return res.status(503).json({ error: 'Firestore not initialized' });
  }

  try {
    await refreshFirebaseData();
    return res.json({ ok: true, message: 'Cache refreshed' });
  } catch (err) {
    console.error('Admin refresh failed:', err);
    return res.status(500).json({ error: err.message });
  }
});

// --- BOOTSTRAP LOGIC ---
const PORT = process.env.PORT || 8000;
const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL && isDirectRun) {
    // 1. Initialize data FIRST, then fire up the HTTP listener
    bootUpDatabase().then(() => {
        app.listen(PORT, () => {
            console.log(`USSD Engine operating seamlessly on system port ${PORT}`);
        });
    }).catch(err => {
        console.error("Critical server failure during initialization:", err);
    });
}

export { app, bootUpDatabase, writeCollectionData };
export default app;