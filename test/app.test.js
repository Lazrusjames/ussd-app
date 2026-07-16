import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createApiRouter } from '../api/index.js';

test('GET /fault-reports returns all fault reports', async () => {
  const reports = [{
    id: 'report-1',
    customer_name: 'Alice Banda',
    phone: '+265991234567',
    fault: 'No Power',
    location: 'Area 2',
    created_at: '2026-07-16T10:00:00.000Z'
  }];

  const app = express();
  app.use(express.json());
  app.use(createApiRouter({
    getDistricts: () => ({}),
    getGroups: () => ({}),
    getSession: () => ({}),
    saveSession: () => {},
    clearSession: () => {},
    getFaultReports: async () => reports,
    saveFaultReport: async () => null
  }));

  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));

  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/fault-reports`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), reports);
  } finally {
    server.close();
  }
});

test('POST /fault-reports stores a new fault report', async () => {
  let savedReport = null;
  const app = express();
  app.use(express.json());
  app.use(createApiRouter({
    getDistricts: () => ({}),
    getGroups: () => ({}),
    getSession: () => ({}),
    saveSession: () => {},
    clearSession: () => {},
    getFaultReports: async () => [],
    saveFaultReport: async (report) => {
      savedReport = report;
      return { id: 'report-2', ...report };
    }
  }));

  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));

  try {
    const payload = {
      customer_name: 'Brian Phiri',
      phone: '+265881112233',
      fault: 'Meter Issues',
      location: 'Area 4'
    };

    const response = await fetch(`http://127.0.0.1:${server.address().port}/fault-reports`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });

    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.customer_name, payload.customer_name);
    assert.equal(body.phone, payload.phone);
    assert.equal(savedReport.customer_name, payload.customer_name);
  } finally {
    server.close();
  }
});

test('POST /ussd starts a fault-report flow when user chooses option 3', async () => {
  const app = express();
  const sessionStore = new Map();
  app.use(express.json());
  app.use(createApiRouter({
    getDistricts: () => ({}),
    getGroups: () => ({}),
    getSession: (sessionId) => sessionStore.get(sessionId) || {},
    saveSession: (sessionId, data) => {
      const previous = sessionStore.get(sessionId) || {};
      sessionStore.set(sessionId, { ...previous, ...data });
    },
    clearSession: (sessionId) => sessionStore.delete(sessionId),
    getFaultReports: async () => [],
    saveFaultReport: async (report) => ({ id: 'report-3', ...report })
  }));

  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));

  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/ussd`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: 'fault-flow', serviceCode: '*123#', phoneNumber: '+265991234567', text: '3' })
    });

    assert.equal(response.status, 200);
    const body = await response.text();
    assert.match(body, /Enter your full name/i);
  } finally {
    server.close();
  }
});
