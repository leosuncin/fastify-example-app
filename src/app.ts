import autoload from '@fastify/autoload';
import sensible from '@fastify/sensible';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import fastify from 'fastify';

export const app = fastify({
  logger: process.stdout.isTTY
    ? {
        transport: {
          target: 'pino-princess',
        },
      }
    : !process.argv.some((arg) => arg.includes('test')),
}).withTypeProvider<TypeBoxTypeProvider>();

app.register(sensible);

app.register(autoload, {
  dir: `${import.meta.dirname}/routes`,
});

app.get('/', (_, reply) => {
  reply.code(204).send();
});
