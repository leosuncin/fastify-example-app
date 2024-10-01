import { Algorithm, sign, verify } from '@node-rs/jsonwebtoken';
import {
  FastifyInstance,
  FastifyPluginCallback,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import { fastifyPlugin } from 'fastify-plugin';
import ms from 'ms';

import type { Config } from '../../config/config.d.ts';
import type { User } from '../schema/user.js';

type SessionPayload = {
  sub: 'authenticate';
  iat: number;
  exp: number;
  aud: 'session';
  usr: Omit<User, 'password'>;
};
type RefreshPayload = {
  sub: 'refresh';
  iat: number;
  exp: number;
  aud: 'session';
  uid: User['id'];
};

export const SESSION_COOKIE_NAME = 'SESSION_TOKEN';
export const REFRESH_COOKIE_NAME = 'REFRESH_TOKEN';

const auth: FastifyPluginCallback<Config> = (
  fastify: FastifyInstance,
  options,
  done,
) => {
  fastify.decorateReply(
    'setAuthenticationTokens',
    async function setAuthenticationTokens(user: Omit<User, 'password'>) {
      const iat = Date.now();
      const secret = options.jwt.jwtSecret.at(-1)!;

      if ('password' in user) {
        delete user.password;
      }

      const sessionToken = await sign(
        {
          sub: 'authenticate',
          iat,
          exp: iat + ms(options.jwt.sessionExpiresIn),
          aud: 'session',
          usr: user,
        } satisfies SessionPayload,
        secret,
        { algorithm: options.jwt.algorithm as Algorithm },
      );
      const refreshToken = await sign(
        {
          sub: 'refresh',
          iat,
          exp: iat + ms(options.jwt.refreshExpiresIn),
          aud: 'session',
          uid: user.id,
        } satisfies RefreshPayload,
        secret,
        { algorithm: options.jwt.algorithm as Algorithm },
      );

      this.setCookie(SESSION_COOKIE_NAME, sessionToken, {
        maxAge: ms(options.jwt.sessionExpiresIn) / 1_000,
      });
      this.setCookie(REFRESH_COOKIE_NAME, refreshToken, {
        maxAge: ms(options.jwt.refreshExpiresIn) / 1_000,
      });
    },
  );

  fastify.decorate(
    'verifySessionToken',
    async function verifySessionToken(request: FastifyRequest) {
      const { [SESSION_COOKIE_NAME]: sessionCookie } = request.cookies;

      fastify.assert(sessionCookie, 401, 'An active session is required');
      const sessionToken = request.unsignCookie(sessionCookie);

      fastify.assert(sessionToken.valid, 401, 'Invalid session cookie');

      try {
        const secret = options.jwt.jwtSecret.at(-1)!;
        const payload = (await verify(sessionToken.value, secret, {
          algorithms: [options.jwt.algorithm as Algorithm],
          sub: 'authenticate',
          aud: ['session'],
          requiredSpecClaims: ['aud', 'exp', 'sub'],
        })) as SessionPayload;

        request.user = payload.usr!;
      } catch (error) {
        fastify.log.error(
          { error },
          error instanceof Error ? error.message : String(error),
        );

        throw fastify.httpErrors.unauthorized('Invalid session token');
      }
    },
  );

  fastify.decorateRequest('userId', null);

  fastify.decorateReply(
    'clearAuthenticationTokens',
    function clearTokens(this: FastifyReply) {
      return this.clearCookie(SESSION_COOKIE_NAME).clearCookie(
        REFRESH_COOKIE_NAME,
      );
    },
  );

  done();
};

export default fastifyPlugin(auth, { name: 'auth-plugin' });
