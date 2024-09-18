import { drizzle } from 'drizzle-orm/postgres-js';

import { users } from './src/schema/user.js';

declare module NodeJS {
  interface ProcessEnv {
    PORT?: string;
    NODE_ENV: 'development' | 'production' | 'test';
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    db: ReturnType<typeof drizzle<{ users: typeof users }>>;
  }

  interface FastifyReply {
    setAuthenticationTokens(user: { email: string }): Promise<void>;
  }
}
