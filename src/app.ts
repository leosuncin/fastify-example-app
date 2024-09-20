import { fastifyAuth } from '@fastify/auth';
import { fastifyAutoload } from '@fastify/autoload';
import { fastifyCookie } from '@fastify/cookie';
import { fastifySensible } from '@fastify/sensible';
import { fastifySwagger } from '@fastify/swagger';
import { fastifySwaggerUi } from '@fastify/swagger-ui';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import fastify from 'fastify';

import type { Config } from '../config/config.d.ts';

export function buildApp(options: Config) {
  return fastify({
    logger: options.logger,
  })
    .withTypeProvider<TypeBoxTypeProvider>()
    .register(fastifySwagger, {
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
    })
    .register(fastifySwaggerUi)
    .register(fastifySensible, {
      sharedSchemaId: 'HttpError',
    })
    .register(fastifyCookie, {
      secret: options.cookie.cookieSecret,
      parseOptions: options.cookie.options,
    })
    .register(fastifyAuth)
    .register(fastifyAutoload, {
      dir: `${import.meta.dirname}/plugins`,
      options,
    })
    .register(fastifyAutoload, {
      dir: `${import.meta.dirname}/routes`,
      routeParams: true,
      options,
    })
    .get('/', (_, reply) => {
      reply.code(204).send();
    });
}
