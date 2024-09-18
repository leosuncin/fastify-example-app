import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildApp } from '../src/app.js';
import config from '../src/config.js';

const app = buildApp(config);

test('GET /', async () => {
  const response = await app.inject().get('/');

  assert.strictEqual(response.statusCode, 204);
  assert.strictEqual(response.payload, '');
});
