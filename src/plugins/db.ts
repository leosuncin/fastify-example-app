import { drizzle } from 'drizzle-orm/postgres-js';
import { FastifyPluginCallback } from 'fastify';
import { fastifyPlugin } from 'fastify-plugin';
import postgres from 'postgres';

import type { Config } from '../../config/config.d.ts';
import { users } from '../schema/user.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: ReturnType<typeof drizzle<{ users: typeof users }>>;
  }
}

const db: FastifyPluginCallback<Config> = (fastify, options, done) => {
  const client = postgres(options.db);
  const db = drizzle(client, {
    schema: { users },
    logger: {
      logQuery(query, params) {
        fastify.log.debug({ query, params });
      },
    },
  });

  fastify.decorate('db', db);

  fastify.addHook('onClose', async () => {
    fastify.log.debug('Closing database connection');
    const [error] = await fastify.to(client.end());

    if (error) {
      fastify.log.error({ error }, 'Error closing database connection');
    }
  });

  done();
};

export default fastifyPlugin(db, { name: 'drizzle-plugin' });
