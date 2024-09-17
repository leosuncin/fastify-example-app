import { hash } from '@node-rs/argon2';
import { Static, Type } from '@sinclair/typebox';
import { count, eq } from 'drizzle-orm';
import type {
  FastifyInstance,
  FastifyPluginAsync,
  RouteShorthandOptions,
} from 'fastify';
import ms from 'ms';

import type { Config } from '../../../config/config.d.ts';
import { users } from '../../schema/user.js';
import { generateTokens } from '../../utils/jwt.js';

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

const registerRoute: FastifyPluginAsync<Config> = async (
  instance: FastifyInstance,
  options,
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

        request.body.password = await hash(request.body.password);
      },
    },
    async (request, reply) => {
      const [user] = await instance.db
        .insert(users)
        .values(request.body)
        .returning({
          bio: users.bio,
          email: users.email,
          image: users.image,
          username: users.username,
        })
        .execute();

      instance.assert(user);

      const [sessionToken, refreshToken] = await generateTokens(user);

      reply
        .code(201)
        .setCookie('SESSION_TOKEN', sessionToken, {
          maxAge: ms(options.jwt.sessionExpiresIn) / 1_000,
        })
        .setCookie('REFRESH_TOKEN', refreshToken, {
          maxAge: ms(options.jwt.refreshExpiresIn) / 1_000,
        })
        .send(user);
    },
  );
};

export default registerRoute;
