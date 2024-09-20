import { cpus } from 'node:os';

import { hash, verify } from '@node-rs/argon2';
import { Static, Type } from '@sinclair/typebox';
import { count, eq } from 'drizzle-orm';
import type {
  FastifyInstance,
  FastifyPluginAsync,
  RouteShorthandOptions,
} from 'fastify';

import type { Config } from '../../../config/config.d.ts';
import { users } from '../../schema/user.js';

const loginBody = Type.Object({
  email: Type.String({ format: 'email' }),
  password: Type.String({ minLength: 8, format: 'password' }),
});

type Login = Static<typeof loginBody>;

const registerBody = Type.Object({
  username: Type.String({ minLength: 1 }),
  email: Type.String({ format: 'email' }),
  password: Type.String({ minLength: 8, format: 'password' }),
});

type Register = Static<typeof registerBody>;

const userResponse = Type.Object({
  bio: Type.Union([Type.String(), Type.Null()]),
  email: Type.String({ format: 'email' }),
  image: Type.Union([Type.String(), Type.Null()]),
  username: Type.String(),
});

type User = Static<typeof userResponse>;

const registerOptions: RouteShorthandOptions = {
  schema: {
    tags: ['User and Authentication'],
    summary: 'Creating a new user',
    description: 'Register a new user',
    operationId: 'Register',
    body: registerBody,
    response: {
      201: userResponse,
      default: { $ref: 'HttpError' },
    },
  },
};

const loginOptions: RouteShorthandOptions = {
  schema: {
    tags: ['User and Authentication'],
    summary: 'Existing user login',
    description: 'Login for existing user',
    operationId: 'Login',
    body: loginBody,
    response: {
      200: userResponse,
      default: { $ref: 'HttpError' },
    },
  },
};

const getCurrentUserOptions: RouteShorthandOptions = {
  schema: {
    tags: ['User and Authentication'],
    summary: 'Get current user',
    description: 'Gets the currently logged-in user',
    operationId: 'GetCurrentUser',
    response: {
      200: userResponse,
      default: { $ref: 'HttpError' },
    },
    security: [{ cookieAuth: [] }],
  },
};

const registerRoute: FastifyPluginAsync<Config> = async (
  instance: FastifyInstance,
) => {
  instance.post<{
    Body: Register;
    Reply: User;
  }>(
    '/register',
    {
      ...registerOptions,
      async preHandler(request) {
        const emailExists = await instance.db
          .select({
            count: count(users.email),
          })
          .from(users)
          .where(eq(users.email, request.body.email))
          .execute();

        instance.assert(
          emailExists.every(({ count }) => count === 0),
          422,
          'Email already exists',
        );

        const usernameExists = await instance.db
          .select({
            count: count(users.username),
          })
          .from(users)
          .where(eq(users.username, request.body.username))
          .execute();

        instance.assert(
          usernameExists.every(({ count }) => count === 0),
          422,
          'Username already exists',
        );

        request.body.password = await hash(request.body.password, {
          parallelism: cpus().length,
        });
      },
    },
    async (request, reply) => {
      const [user] = await instance.db
        .insert(users)
        .values(request.body)
        .returning({
          id: users.id,
          bio: users.bio,
          email: users.email,
          image: users.image,
          username: users.username,
        })
        .execute();

      instance.assert(user);

      await reply.setAuthenticationTokens(user);

      reply.code(201).send(user);
    },
  );

  instance.post<{
    Body: Login;
    Reply: User;
  }>('/login', loginOptions, async (request, reply) => {
    const [user] = await instance.db
      .select({
        id: users.id,
        bio: users.bio,
        email: users.email,
        image: users.image,
        password: users.password,
        username: users.username,
      })
      .from(users)
      .where(eq(users.email, request.body.email))
      .execute();

    instance.assert(user, 401, 'Invalid email');

    const hasValidPassword = await verify(
      user.password,
      request.body.password,
      {
        parallelism: cpus().length,
      },
    );

    instance.assert(hasValidPassword, 401, 'Invalid password');

    await reply.setAuthenticationTokens(user);

    reply.send(user);
  });

  instance.get<{ Reply: User }>(
    '/me',
    {
      ...getCurrentUserOptions,
      onRequest: instance.auth([instance.verifyTokens]),
    },
    async (request, reply) => {
      reply.send(request.user as User);
    },
  );
};

export default registerRoute;
