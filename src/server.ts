import closeWithGrace from 'close-with-grace';

import { buildApp } from './app.js';
import config from './config.js';

const app = buildApp(config);

closeWithGrace(async ({ err: error, signal }) => {
  if (error) {
    app.log.error({ error }, 'Shutting down server with error');
  } else {
    app.log.info(`Signal ${signal} received. Shutting down server`);
  }
});

try {
  // @ts-expect-error port can be a string or number
  await app.listen(config.server);
} catch (error) {
  app.log.error({ error }, 'Failed to start server');
}
