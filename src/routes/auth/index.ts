import { hash } from '@node-rs/argon2';
import { Static, Type } from '@sinclair/typebox';
import type { FastifyPluginAsync, RouteShorthandOptions } from 'fastify';

import { users } from '../../schema/user.js';

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

const registerRoute: FastifyPluginAsync = async (instance) => {
  instance.post<{
    Body: Register;
    Reply: User;
  }>(
    '/register',
    {
      ...registerOptions,
      async preHandler(request) {
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

      reply.code(201).send(user);
    },
  );
};

export default registerRoute;
