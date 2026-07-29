/**
 * @fileoverview Power Management & Fault Reporting Data Handler
 * @module services/dataService
 * @author Lazarus Mphande
 * @created 2026
 */



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

//Description of the MongoDB schemas for districts, groups, and fault reports


//District Schema
const districtSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  region: { type: String, required: true },
  group: { type: String, required: true },
  outageSchedule: { type: [String], default: [] },
  averageDuration: { type: String, default: '' }
}, { versionKey: false, collection: DISTRICTS_COLLECTION });


//Group Schema
const groupSchema = new mongoose.Schema({
  group: { type: String, required: true, unique: true },
  schedule: { type: [String], default: [] },
  description: { type: String, default: '' }
}, { versionKey: false, collection: GROUPS_COLLECTION });


//Fault Report Schema
const faultReportSchema = new mongoose.Schema({
  customer_name: { type: String, default: '' },
  phone: { type: String, default: '' },
  fault: { type: String, default: '' },
  location: { type: String, default: '' },
  created_at: { type: String, required: true },
  created_date: { type: String, required: true }
}, { versionKey: false, collection: FAULT_REPORTS_COLLECTION });


//Important: Use existing models if they exist to avoid OverwriteModelError
const District = mongoose.models.District || mongoose.model('District', districtSchema);
const Group = mongoose.models.Group || mongoose.model('Group', groupSchema);
const FaultReport = mongoose.models.FaultReport || mongoose.model('FaultReport', faultReportSchema);




/* ============================================================================
 * Function : getCollectionData
 * Author   : Lazarus Mphande
 * Purpose  : Safely fetches database records as indexed maps with offline fallbacks.
 * ============================================================================ */

const getCollectionData = async (collectionName) => {
  if (!mongoAvailable) {
    return collectionName === DISTRICTS_COLLECTION ? { ...DEFAULT_DISTRICTS } : { ...DEFAULT_GROUPS };
  }


  //changing the key for districts to be the district id and for groups to be the group name
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



/**
 * Writes and syncs collection data back to persistent storage or in-memory state.
 * Performs a full database overwrite (deleteMany + insertMany) when MongoDB is online,
 * or updates local in-memory objects when offline.
 *
 * @author Lazarus Mphande
 * @param {string} collectionName - Target collection identifier (DISTRICTS_COLLECTION or GROUPS_COLLECTION).
 * @param {Object} data - Key-value map of dataset items to persist.
 * @returns {Promise<void>}
 */

const writeCollectionData = async (collectionName, data) => {


  // Offline Mode: Persist changes directly to local in-memory state
  if (!mongoAvailable) {
    if (collectionName === DISTRICTS_COLLECTION) {
      DISTRICTS = { ...data };
    }
    if (collectionName === GROUPS_COLLECTION) {
      GROUPS = { ...data };
    }
    return;
  }



  // Convert key-value object back to an array of document items for Mongoose insertion
  const items = Object.values(data);

  // Overwrite Districts collection
  if (collectionName === DISTRICTS_COLLECTION) {
    await District.deleteMany({});
    await District.insertMany(items);
  }

  // Overwrite Groups collection
  if (collectionName === GROUPS_COLLECTION) {
    await Group.deleteMany({});
    await Group.insertMany(items);
  }
};


/**
 * Automatically seeds default District and Group datasets into MongoDB 
 * if the database collections are currently empty.
 *
 * @author Lazarus Mphande
 * @returns {Promise<void>}
 */


const seedCollectionsIfEmpty = async () => {

  // Exit early if the MongoDB connection is unavailable
  if (!mongoAvailable) {
    return;
  }

  // Perform parallel document count checks across both collections for performance
  const [districtCount, groupCount] = await Promise.all([
    District.countDocuments(),
    Group.countDocuments()
  ]);



  // Seed default districts if collection is brand new / empty
  if (districtCount === 0) {
    await District.insertMany(Object.values(DEFAULT_DISTRICTS));
  }


  // Seed default groups if collection is brand new / empty
  if (groupCount === 0) {
    await Group.insertMany(Object.values(DEFAULT_GROUPS));
  }
};


/**
 * Synchronizes and updates the in-memory cache (DISTRICTS and GROUPS) with fresh data.
 * Pulls current records from MongoDB in parallel, or reloads default datasets if offline.
 *
 * @author Lazarus Mphande
 * @returns {Promise<void>}
 */


const refreshMongoData = async () => {

  // Offline Mode: Reset in-memory cache directly to static defaults
  if (!mongoAvailable) {
    DISTRICTS = { ...DEFAULT_DISTRICTS };
    GROUPS = { ...DEFAULT_GROUPS };
    return;
  }


  // Fetch updated district and group maps concurrently from MongoDB
  const [districts, groups] = await Promise.all([
    getCollectionData(DISTRICTS_COLLECTION),
    getCollectionData(GROUPS_COLLECTION)
  ]);


// Update global in-memory state with freshly indexed database maps
  DISTRICTS = districts;
  GROUPS = groups;
};



/**
 * Initializes the MongoDB database connection and syncs the initial application state.
 * Establishes Mongoose connectivity, seeds empty collections, hydrates in-memory caches,
 * and sets up graceful fallback mechanisms if connection or environment variables fail.
 *
 * @author Lazarus Mphande
 * @returns {Promise<void>}
 */

const initializeMongoBackend = async () => {

  // Environment Check: Fallback to local state if no connection URI is provided
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    mongoAvailable = false;
    mongoInitializationError = null;
    return;
  }

  
  try {
    // Reuse existing connection if active (readyState === 0 means disconnected)
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri, {
        dbName: process.env.MONGODB_DB || 'ussd'
      });
    }


    // Flag database as ready and execute initial seed & cache sync
    mongoAvailable = true;
    mongoInitializationError = null;
    await seedCollectionsIfEmpty();
    await refreshMongoData();
    console.log('MongoDB connected and synced successfully.');
  } catch (error) {

    // Error Handling: Flag database as unavailable and switch to local default datasets
    mongoAvailable = false;
    mongoInitializationError = error.message;
    console.warn('MongoDB initialization failed; using in-memory fallback:', error.message);
    DISTRICTS = { ...DEFAULT_DISTRICTS };
    GROUPS = { ...DEFAULT_GROUPS };
  }
};




/**
 * Retrieves all fault reports sorted by creation date in descending order (newest first).
 * Serves sorted reports from memory if offline, or fetches from MongoDB with mapped string IDs.
 *
 * @author Lazarus Mphande
 * @returns {Promise<Array<Object>>} Array of fault report objects sorted newest to oldest.
 */
const getFaults = async () => {


  // Offline Mode: Sort and return in-memory fault reports from newest to oldest
  if (!mongoAvailable) {
    return [...MEMORY_FAULT_REPORTS].sort((a, b) => {
      const aDate = new Date(a.created_at || a.created_date || 0).getTime();
      const bDate = new Date(b.created_at || b.created_date || 0).getTime();
      return bDate - aDate;
    });
  }

  // Online Mode: Fetch from MongoDB sorted by created_at descending (newest first)
  const reports = await FaultReport.find({}).sort({ created_at: -1 }).lean();

  // Normalize MongoDB _id into a plain string id field for client/API compatibility
  return reports.map((report) => ({ id: report._id.toString(), ...report }));
};






const saveFault = async (report) => {
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
  saveFault
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