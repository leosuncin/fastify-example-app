import { FastifyPluginAsync } from 'fastify';

const api: FastifyPluginAsync = async (instance) => {
  instance.get<{ Querystring: { name: string } }>('/hello', async (request) => {
    const { name = 'world' } = request.query;

    return { hello: name };
  });
};

export default api;
