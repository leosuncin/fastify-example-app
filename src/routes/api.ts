import { Static, Type } from '@sinclair/typebox';
import { FastifyPluginAsync, RouteShorthandOptions } from 'fastify';

const QueryHello = Type.Object({
  name: Type.Optional(Type.String({ default: 'world' })),
});
const ResponseHello = Type.Object({
  hello: Type.String(),
});
const helloOptions: RouteShorthandOptions = {
  schema: {
    querystring: QueryHello,
    response: {
      200: ResponseHello,
    },
  },
};

const api: FastifyPluginAsync = async (instance) => {
  instance.get<{
    Querystring: Static<typeof QueryHello>;
    Reply: Static<typeof ResponseHello>;
  }>('/hello', helloOptions, async (request) => {
    const { name = 'world' } = request.query;

    return { hello: name };
  });
};

export default api;
