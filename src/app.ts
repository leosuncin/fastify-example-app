import sensible from '@fastify/sensible';
import fastify from 'fastify';

export const app = fastify({
  logger: process.stdout.isTTY
    ? {
        transport: {
          target: 'pino-princess',
        },
      }
    : !process.argv.some((arg) => arg.includes('test')),
});

app.register(sensible);

app.get('/', (_, reply) => {
  reply.code(204).send();
});
