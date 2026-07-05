import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { appendMockSale, readMockSales, writeMockSales } from '../app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tempFile = path.join(__dirname, 'temp-mock-sales.json');

test('appendMockSale writes a new sale into the mock sales JSON file', () => {
  const initialSales = [{ id: 'sale-test-1', status: 'pending' }];
  writeMockSales(initialSales, tempFile);

  const sale = {
    id: 'sale-test-2',
    phoneNumber: '+265991234567',
    crop: 'Maize',
    region: 'Southern',
    quantity: 8,
    status: 'pending'
  };

  appendMockSale(sale, tempFile);

  const savedSales = readMockSales(tempFile);
  assert.equal(savedSales.length, 2);
  assert.deepEqual(savedSales[1], sale);

  fs.unlinkSync(tempFile);
});
