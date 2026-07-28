import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { createApiRouter } from './api/index.js';   //

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DISTRICTS_COLLECTION = 'districts';
const GROUPS_COLLECTION = 'groups';
const FAULT_REPORTS_COLLECTION = 'faults';

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
let DISTRICTS = { ...DEFAULT_DISTRICTS };
let GROUPS = { ...DEFAULT_GROUPS };
const MEMORY_FAULT_REPORTS = [];
let mongoAvailable = false;
let mongoInitializationError = null;

const districtSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  region: { type: String, required: true },
  group: { type: String, required: true },
  outageSchedule: { type: [String], default: [] },
  averageDuration: { type: String, default: '' }
}, { versionKey: false, collection: DISTRICTS_COLLECTION });

const groupSchema = new mongoose.Schema({
  group: { type: String, required: true, unique: true },
  schedule: { type: [String], default: [] },
  description: { type: String, default: '' }
}, { versionKey: false, collection: GROUPS_COLLECTION });

const faultReportSchema = new mongoose.Schema({
  customer_name: { type: String, default: '' },
  phone: { type: String, default: '' },
  fault: { type: String, default: '' },
  location: { type: String, default: '' },
  created_at: { type: String, required: true },
  created_date: { type: String, required: true }
}, { versionKey: false, collection: FAULT_REPORTS_COLLECTION });

const District = mongoose.models.District || mongoose.model('District', districtSchema);
const Group = mongoose.models.Group || mongoose.model('Group', groupSchema);
const FaultReport = mongoose.models.FaultReport || mongoose.model('FaultReport', faultReportSchema);

const getCollectionData = async (collectionName) => {
  if (!mongoAvailable) {
    return collectionName === DISTRICTS_COLLECTION ? { ...DEFAULT_DISTRICTS } : { ...DEFAULT_GROUPS };
  }

  if (collectionName === DISTRICTS_COLLECTION) {
    const documents = await District.find({}).lean();
    return documents.reduce((collection, document) => {
      collection[document.id] = document;
      return collection;
    }, {});
  }

  if (collectionName === GROUPS_COLLECTION) {
    const documents = await Group.find({}).lean();
    return documents.reduce((collection, document) => {
      collection[document.group] = document;
      return collection;
    }, {});
  }

  return {};
};

const writeCollectionData = async (collectionName, data) => {
  if (!mongoAvailable) {
    if (collectionName === DISTRICTS_COLLECTION) {
      DISTRICTS = { ...data };
    }
    if (collectionName === GROUPS_COLLECTION) {
      GROUPS = { ...data };
    }
    return;
  }

  const items = Object.values(data);
  if (collectionName === DISTRICTS_COLLECTION) {
    await District.deleteMany({});
    await District.insertMany(items);
  }
  if (collectionName === GROUPS_COLLECTION) {
    await Group.deleteMany({});
    await Group.insertMany(items);
  }
};

const seedCollectionsIfEmpty = async () => {
  if (!mongoAvailable) {
    return;
  }

  const [districtCount, groupCount] = await Promise.all([
    District.countDocuments(),
    Group.countDocuments()
  ]);

  if (districtCount === 0) {
    await District.insertMany(Object.values(DEFAULT_DISTRICTS));
  }

  if (groupCount === 0) {
    await Group.insertMany(Object.values(DEFAULT_GROUPS));
  }
};

const refreshMongoData = async () => {
  if (!mongoAvailable) {
    DISTRICTS = { ...DEFAULT_DISTRICTS };
    GROUPS = { ...DEFAULT_GROUPS };
    return;
  }

  const [districts, groups] = await Promise.all([
    getCollectionData(DISTRICTS_COLLECTION),
    getCollectionData(GROUPS_COLLECTION)
  ]);

  DISTRICTS = districts;
  GROUPS = groups;
};

const initializeMongoBackend = async () => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    mongoAvailable = false;
    mongoInitializationError = null;
    return;
  }

  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri, {
        dbName: process.env.MONGODB_DB || 'ussd'
      });
    }

    mongoAvailable = true;
    mongoInitializationError = null;
    await seedCollectionsIfEmpty();
    await refreshMongoData();
    console.log('MongoDB connected and synced successfully.');
  } catch (error) {
    mongoAvailable = false;
    mongoInitializationError = error.message;
    console.warn('MongoDB initialization failed; using in-memory fallback:', error.message);
    DISTRICTS = { ...DEFAULT_DISTRICTS };
    GROUPS = { ...DEFAULT_GROUPS };
  }
};

const getFaults = async () => {
  if (!mongoAvailable) {
    return [...MEMORY_FAULT_REPORTS].sort((a, b) => {
      const aDate = new Date(a.created_at || a.created_date || 0).getTime();
      const bDate = new Date(b.created_at || b.created_date || 0).getTime();
      return bDate - aDate;
    });
  }

  const reports = await FaultReport.find({}).sort({ created_at: -1 }).lean();
  return reports.map((report) => ({ id: report._id.toString(), ...report }));
};

const saveFaultReport = async (report) => {
  const payload = {
    ...report,
    created_at: report.created_at || report.created_date || new Date().toISOString(),
    created_date: report.created_date || report.created_at || new Date().toISOString()
  };

  if (!mongoAvailable) {
    MEMORY_FAULT_REPORTS.push(payload);
    return { id: `memory-${MEMORY_FAULT_REPORTS.length}`, ...payload };
  }

  const saved = await FaultReport.create(payload);
  return { id: saved._id.toString(), ...saved.toObject() };
};

const refreshDatabaseData = async () => {
  if (mongoAvailable) {
    await refreshMongoData();
  } else {
    DISTRICTS = { ...DEFAULT_DISTRICTS };
    GROUPS = { ...DEFAULT_GROUPS };
  }
};

// --- THIS RUNS ONLY ONCE AT SERVER BOOT ---
const bootUpDatabase = async () => {
  await initializeMongoBackend();
  if (!mongoAvailable) {
    DISTRICTS = { ...DEFAULT_DISTRICTS };
    GROUPS = { ...DEFAULT_GROUPS };
  }
  console.log(`Database ready using ${mongoAvailable ? 'MongoDB' : 'in-memory fallback'}.`);
};

// Standard Express setup
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Session management
const sessionStore = {};
const saveSession = (sessionId, data) => {
    sessionStore[sessionId] = { ...sessionStore[sessionId], ...data };
};
const getSession = (sessionId) => sessionStore[sessionId] || {};
const clearSession = (sessionId) => { delete sessionStore[sessionId]; };

// Ensure the configured backend is initialized before serving requests
let _databaseInitialized = false;
app.use(async (req, res, next) => {
  if (!_databaseInitialized) {
    try {
      await bootUpDatabase();
      _databaseInitialized = true;
    } catch (err) {
      console.error('Failed to initialize database backend on request:', err.message);
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
  clearSession,
  getFaults,
  saveFaultReport
}));

// Health check endpoint for deployments and monitoring
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    database: mongoAvailable ? 'mongodb' : 'memory',
    databaseAvailable: mongoAvailable || true,
    databaseInitialized: !!_databaseInitialized,
    mongoInitializationError
  });
});

// Per-request data-source header and simple logging
app.use((req, res, next) => {
  const dataSource = mongoAvailable ? 'mongodb' : 'memory';
  res.set('X-Data-Source', dataSource);
  console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl} dataSource=${dataSource}`);
  next();
});

// Admin endpoint to refresh the active backend cache (protected by ADMIN_SECRET env var)
app.post('/admin/refresh', async (req, res) => {
  const secret = req.headers['x-admin-secret'] || req.body?.secret;
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await refreshDatabaseData();
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

// for deployment
export { app, bootUpDatabase, writeCollectionData, getFaults, saveFaultReport };
export default app;