import assert from 'node:assert/strict';
import { test } from 'node:test';

import { app } from 'src/app.js';

test('GET /', async () => {
  const response = await app.inject().get('/');

  assert.strictEqual(response.statusCode, 204);
  assert.strictEqual(response.payload, '');
});
