/// <reference types="../src/overrides.d.ts" />

import assert from 'node:assert/strict';
import { cpus } from 'node:os';
import { afterEach, before, beforeEach, describe, it } from 'node:test';

import { IntegreSQLClient } from '@devoxa/integresql-client';
import { faker } from '@faker-js/faker';
import { hash as hashArgon2 } from '@node-rs/argon2';
import { Algorithm, sign } from '@node-rs/jsonwebtoken';
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

  describe('POST /auth/register', () => {
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
      const response = await app
        .inject()
        .post('/auth/register')
        .payload(payload);

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

      const response = await app
        .inject()
        .post('/auth/register')
        .payload(payload);

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

      const response = await app
        .inject()
        .post('/auth/register')
        .payload(payload);

      assert.equal(response.statusCode, 422);
      assert.deepEqual(response.json(), {
        error: 'Unprocessable Entity',
        message: 'Email already exists',
        statusCode: 422,
      });
    });
  });

  describe('POST /auth/login', () => {
    it('validate the login data', async () => {
      const response = await app.inject().post('/auth/login').payload({});

      assert.equal(response.statusCode, 400);
      assert.ok(
        'error' in response.json() && response.json().error === 'Bad Request',
      );
    });

    it('login with a valid user', async () => {
      const password = faker.internet.password();
      const [user] = await app.db
        .insert(users)
        .values({
          username: faker.internet.userName(),
          email: faker.internet.email(),
          password: await hashArgon2(password, { parallelism: cpus().length }),
        })
        .returning()
        .execute();

      const response = await app
        .inject()
        .post('/auth/login')
        .payload({ email: user.email, password });

      assert.equal(response.statusCode, 200);
      assert.deepEqual(response.json(), {
        bio: '',
        email: user.email,
        image: null,
        username: user.username,
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

    it('fail to login with an invalid email', async () => {
      const response = await app.inject().post('/auth/login').payload({
        email: faker.internet.email(),
        password: faker.internet.password(),
      });

      assert.equal(response.statusCode, 401);
      assert.deepEqual(response.json(), {
        error: 'Unauthorized',
        message: 'Invalid email',
        statusCode: 401,
      });
      assert.equal(response.cookies.length, 0);
    });

    it('fail to login with an invalid password', async () => {
      const password = faker.internet.password();
      const [user] = await app.db
        .insert(users)
        .values({
          username: faker.internet.userName(),
          email: faker.internet.email(),
          password: await hashArgon2(password, { parallelism: cpus().length }),
        })
        .returning()
        .execute();

      const response = await app
        .inject()
        .post('/auth/login')
        .payload({ email: user.email, password: faker.internet.password() });

      assert.equal(response.statusCode, 401);
      assert.deepEqual(response.json(), {
        error: 'Unauthorized',
        message: 'Invalid password',
        statusCode: 401,
      });
      assert.equal(response.cookies.length, 0);
    });
  });

  describe('GET /auth/me', () => {
    it('validate that the session cookie is required', async () => {
      const response = await app.inject().get('/auth/me');

      assert.equal(response.statusCode, 401);
      assert.equal(response.json().message, 'An active session is required');
    });

    it('validate that the session cookie is signed', async () => {
      const sessionToken = await sign(
        {
          sub: 'authenticate',
          iat: Date.now(),
          exp: Date.now() + ms(config.jwt.sessionExpiresIn),
          aud: 'session',
          usr: {
            id: 1,
            email: faker.internet.email(),
            username: faker.internet.userName(),
            bio: '',
            image: null,
          },
        },
        config.jwt.jwtSecret.at(-1)!,
        { algorithm: config.jwt.algorithm as Algorithm },
      );
      const response = await app
        .inject()
        .get('/auth/me')
        .cookies({ [SESSION_COOKIE_NAME]: sessionToken });

      assert.equal(response.statusCode, 401);
      assert.equal(response.json().message, 'Invalid session cookie');
    });

    it('validate that the session cookie is valid', async () => {
      const secret = config.jwt.jwtSecret.at(-1)!;
      const sessionToken = await sign(
        {
          iat: Date.now(),
          exp: Date.now() + ms(config.jwt.sessionExpiresIn),
        },
        secret,
      );

      const response = await app
        .inject()
        .get('/auth/me')
        .cookies({ [SESSION_COOKIE_NAME]: sessionToken });

      assert.equal(response.statusCode, 401);
      assert.equal(response.json().message, 'Invalid session cookie');
    });

    it("validate that the session token's claims are valid", async () => {
      const secret = config.jwt.jwtSecret.at(-1)!;
      const user = {
        id: 1,
        email: faker.internet.email(),
        username: faker.internet.userName(),
        bio: '',
        image: null,
      };
      const sessionToken = await sign(
        {
          sub: 'authenticate',
          exp: Date.now() + ms(config.jwt.sessionExpiresIn),
          aud: 'refresh',
          usr: user,
        },
        secret,
      );
      const response = await app
        .inject()
        .get('/auth/me')
        .cookies({ [SESSION_COOKIE_NAME]: app.signCookie(sessionToken) });

      assert.equal(response.statusCode, 401);
      assert.equal(response.json().message, 'Invalid session token');
    });

    it('respond with the user from the session', async () => {
      const secret = config.jwt.jwtSecret.at(-1)!;
      const user = {
        id: 1,
        email: faker.internet.email(),
        username: faker.internet.userName(),
        bio: '',
        image: null,
      };
      const sessionToken = await sign(
        {
          sub: 'authenticate',
          iat: Date.now(),
          exp: Date.now() + ms(config.jwt.sessionExpiresIn),
          aud: 'session',
          usr: user,
        },
        secret,
        { algorithm: config.jwt.algorithm as Algorithm },
      );
      const response = await app
        .inject()
        .get('/auth/me')
        .cookies({ [SESSION_COOKIE_NAME]: app.signCookie(sessionToken) });

      assert.equal(response.statusCode, 200);
      assert.deepEqual(response.json(), {
        email: user.email,
        username: user.username,
        bio: user.bio,
        image: user.image,
      });
    });
  });

  describe('DELETE /auth/logout', () => {
    it('clear the authentication cookies', async () => {
      const response = await app.inject().delete('/auth/logout');

      assert.equal(response.statusCode, 204);
      assert.equal(response.cookies.length, 2);
      assert.ok(
        response.cookies.every(
          ({ httpOnly, sameSite, secure, expires }) =>
            httpOnly &&
            sameSite!.localeCompare(config.cookie.options.sameSite!, 'en', {
              sensitivity: 'base',
            }) === 0 &&
            !!secure === config.cookie.options.secure &&
            expires!.getTime() < Date.now(),
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
      assert.equal(sessionCookie.value, '');
      assert.equal(refreshCookie.value, '');
    });
  });

  describe('POST /auth/refresh', () => {
    it('respond with the user and a new session cookie', async () => {
      const secret = config.jwt.jwtSecret.at(-1)!;
      const [user] = await app.db
        .insert(users)
        .values({
          email: faker.internet.email(),
          username: faker.internet.userName(),
          password: '',
        })
        .returning()
        .execute();
      const refreshTokenToken = await sign(
        {
          sub: 'refresh',
          iat: Date.now(),
          exp: Date.now() + ms(config.jwt.refreshExpiresIn),
          aud: 'session',
          uid: user.id,
        },
        secret,
        { algorithm: config.jwt.algorithm as Algorithm },
      );
      const response = await app
        .inject()
        .post('/auth/refresh')
        .cookies({ [REFRESH_COOKIE_NAME]: app.signCookie(refreshTokenToken) });

      assert.equal(response.statusCode, 200);
      assert.deepEqual(response.json(), {
        email: user.email,
        username: user.username,
        bio: user.bio,
        image: user.image,
      });

      assert.equal(response.cookies.length, 1);
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
      assert.ok(response.cookies[0].name === SESSION_COOKIE_NAME);
    });

    it('validate that the refresh cookie is required', async () => {
      const response = await app.inject().post('/auth/refresh');

      assert.equal(response.statusCode, 401);
      assert.equal(response.json().message, 'A refresh cookie is required');
    });

    it('validate that the refresh cookie is signed', async () => {
      const response = await app
        .inject()
        .post('/auth/refresh')
        .cookies({ [REFRESH_COOKIE_NAME]: 'not-a-signed-value' });

      assert.equal(response.statusCode, 401);
      assert.equal(response.json().message, 'Invalid refresh cookie');
    });

    it("validate that the refresh token's claims are valid", async () => {
      const secret = config.jwt.jwtSecret.at(-1)!;
      const refreshToken = await sign(
        {
          sub: 'authentication',
          iat: Date.now(),
          exp: Date.now() + ms(config.jwt.refreshExpiresIn),
          aud: 'refresh',
        },
        secret,
      );

      const response = await app
        .inject()
        .post('/auth/refresh')
        .cookies({ [REFRESH_COOKIE_NAME]: app.signCookie(refreshToken) });

      assert.equal(response.statusCode, 401);
      assert.equal(response.json().message, 'Invalid refresh token');
    });

    it('forbid the access if the user no longer exists', async () => {
      const secret = config.jwt.jwtSecret.at(-1)!;

      const refreshToken = await sign(
        {
          sub: 'refresh',
          exp: Date.now() + ms(config.jwt.refreshExpiresIn),
          aud: 'session',
          uid: 403,
        },
        secret,
      );
      const response = await app
        .inject()
        .post('/auth/refresh')
        .cookies({ [REFRESH_COOKIE_NAME]: app.signCookie(refreshToken) });

      assert.equal(response.statusCode, 403);
      assert.equal(response.json().message, 'User no longer exists');
    });
  });
});
