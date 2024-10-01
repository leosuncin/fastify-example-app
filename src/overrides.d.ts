import { FastifyAuthFunction } from '@fastify/auth';
import { drizzle } from 'drizzle-orm/postgres-js';

import { User, users } from './src/schema/user.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: ReturnType<typeof drizzle<{ users: typeof users }>>;
    verifySessionToken: FastifyAuthFunction;
  }

  interface FastifyRequest {
    user: Omit<User, 'password'> | null;
  }

  interface FastifyReply {
    setAuthenticationTokens(user: { email: string }): Promise<void>;
    clearAuthenticationTokens(): FastifyReply;
  }
}
