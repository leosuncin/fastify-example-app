import { fastifyAutoload } from '@fastify/autoload';
import { fastifyCookie } from '@fastify/cookie';
import { fastifySensible } from '@fastify/sensible';
import { fastifySwagger } from '@fastify/swagger';
import { fastifySwaggerUi } from '@fastify/swagger-ui';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import fastify from 'fastify';

import config from './config.js';

export const app = fastify({
  logger: process.argv.some((arg) => arg.includes('test'))
    ? false
    : config.logger,
}).withTypeProvider<TypeBoxTypeProvider>();

app.register(fastifySwagger, {
  openapi: {
    info: {
      title: 'RealWorld Conduit API',
      description: 'Conduit API documentation',
      contact: {
        name: 'RealWorld',
        url: 'https://www.realworld.how',
      },
      license: {
        name: 'MIT License',
        url: 'https://opensource.org/licenses/MIT',
      },
      version: '2.0.0',
    },
    servers: [{ url: 'http://localhost:1337' }],
    tags: [
      { name: 'Articles' },
      { name: 'Comments' },
      { name: 'Favorites' },
      { name: 'Profile' },
      { name: 'Tags' },
      { name: 'User and Authentication' },
    ],
  },
});

app.register(fastifySwaggerUi);

app.register(fastifySensible, {
  sharedSchemaId: 'HttpError',
});

app.register(fastifyCookie, {
  secret: config.cookie.cookieSecret,
  parseOptions: config.cookie.options,
});

app.register(fastifyAutoload, {
  dir: `${import.meta.dirname}/plugins`,
  options: config,
});

app.register(fastifyAutoload, {
  dir: `${import.meta.dirname}/routes`,
  routeParams: true,
  options: config,
});

app.get('/', (_, reply) => {
  reply.code(204).send();
});
