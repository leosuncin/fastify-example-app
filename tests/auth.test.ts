/// <reference types="../src/override.d.ts" />

import assert from 'node:assert/strict';
import { afterEach, before, beforeEach, describe, it } from 'node:test';

import { IntegreSQLClient } from '@devoxa/integresql-client';
import { faker } from '@faker-js/faker';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import ms from 'ms';
import postgres from 'postgres';

import { buildApp } from '../src/app.js';
import config from '../src/config.js';
import {
  REFRESH_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from '../src/plugins/auth.js';
import { users } from '../src/schema/user.js';

const integreSQLClient = new IntegreSQLClient({
  url: process.env['INTEGRESQL_URL'] ?? 'http://localhost:5000',
});

describe('Auth routes', () => {
  let app: ReturnType<typeof buildApp>;
  let hash: string;

  before(async () => {
    hash = await integreSQLClient.hashFiles([
      'migrations/**/*',
      'src/schema/**/*.ts',
    ]);

    await integreSQLClient.initializeTemplate(
      hash,
      async ({ username, password, database }) => {
        const client = postgres({
          database,
          username,
          password,
          max: 1,
          onnotice: () => {},
        });
        const db = drizzle(client, { logger: false });

        await migrate(db, { migrationsFolder: 'migrations' });
        await client.end();
      },
    );
  });

  beforeEach(async () => {
    const { username, password, database, port } =
      await integreSQLClient.getTestDatabase(hash);
    app = buildApp({
      ...config,
      db: {
        user: username,
        password,
        database,
        port,
        host: 'localhost',
      },
    });

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('validate the register data', async () => {
    const response = await app.inject().post('/auth/register').payload({});

    assert.equal(response.statusCode, 400);
    assert.ok(
      'error' in response.json() && response.json().error === 'Bad Request',
    );
  });

  it('register a new user', async () => {
    const payload = {
      username: faker.internet.userName(),
      email: faker.internet.email(),
      password: faker.internet.password(),
    };
    const response = await app.inject().post('/auth/register').payload(payload);

    assert.equal(response.statusCode, 201);
    assert.deepEqual(response.json(), {
      bio: '',
      email: payload.email,
      image: null,
      username: payload.username,
    });
    assert.equal(response.cookies.length, 2);
    assert.ok(
      response.cookies.every(
        ({ httpOnly, sameSite, secure }) =>
          httpOnly &&
          sameSite!.localeCompare(config.cookie.options.sameSite!, 'en', {
            sensitivity: 'base',
          }) === 0 &&
          !!secure === config.cookie.options.secure,
      ),
    );

    const sessionCookie = response.cookies.find(
      (cookie) => cookie.name === SESSION_COOKIE_NAME,
    );
    const refreshCookie = response.cookies.find(
      (cookie) => cookie.name === REFRESH_COOKIE_NAME,
    );

    assert.ok(sessionCookie);
    assert.ok(refreshCookie);
    assert.equal(
      ms(sessionCookie.maxAge! * 1_000),
      config.jwt.sessionExpiresIn,
    );
    assert.equal(
      ms(refreshCookie.maxAge! * 1_000),
      config.jwt.refreshExpiresIn,
    );
  });

  it('avoid to register a duplicated username', async () => {
    const username = faker.internet.userName();
    const payload = {
      username,
      email: faker.internet.email(),
      password: faker.internet.password(),
    };

    await app.db
      .insert(users)
      .values({ username, email: '', password: '' })
      .execute();

    const response = await app.inject().post('/auth/register').payload(payload);

    assert.equal(response.statusCode, 422);
    assert.deepEqual(response.json(), {
      error: 'Unprocessable Entity',
      message: 'Username already exists',
      statusCode: 422,
    });
  });

  it('avoid to register a duplicated email', async () => {
    const email = faker.internet.email();
    const payload = {
      email,
      username: faker.internet.userName(),
      password: faker.internet.password(),
    };

    await app.db
      .insert(users)
      .values({ username: '', email, password: '' })
      .execute();

    const response = await app.inject().post('/auth/register').payload(payload);

    assert.equal(response.statusCode, 422);
    assert.deepEqual(response.json(), {
      error: 'Unprocessable Entity',
      message: 'Email already exists',
      statusCode: 422,
    });
  });
});
