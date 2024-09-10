/// <reference path="./override.d.ts" />
import { parseArgs } from 'node:util';

import closeWithGrace from 'close-with-grace';

import { app } from './app.js';

const options = parseArgs({
  args: process.argv.slice(2),
  options: {
    port: {
      type: 'string',
      default: process.env.PORT ?? '1337',
    },
    host: {
      type: 'string',
      default: 'localhost',
    },
  },
  tokens: false,
});
const port = Number.parseInt(options.values.port!, 10);
const host = options.values.host!;

closeWithGrace(async ({ err: error, signal }) => {
  if (error) {
    app.log.error({ error }, 'Shutting down server with error');
  } else {
    app.log.info(`Signal ${signal} received. Shutting down server`);
  }
});

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error({ error }, 'Failed to start server');
}
