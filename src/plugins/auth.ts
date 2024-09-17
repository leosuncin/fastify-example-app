import { Algorithm, sign } from '@node-rs/jsonwebtoken';
import { FastifyPluginCallback } from 'fastify';
import { fastifyPlugin } from 'fastify-plugin';
import ms from 'ms';

import type { Config } from '../../config/config.d.ts';

declare module 'fastify' {
  interface FastifyReply {
    setAuthenticationTokens(user: { email: string }): Promise<void>;
  }
}

const SESSION_COOKIE_NAME = 'SESSION_TOKEN';
const REFRESH_COOKIE_NAME = 'REFRESH_TOKEN';

const auth: FastifyPluginCallback<Config> = (fastify, options, done) => {
  fastify.decorateReply(
    'setAuthenticationTokens',
    async function setAuthenticationTokens(user: { email: string }) {
      const iat = Date.now();
      const secret = options.jwt.jwtSecret.at(-1)!;

      const sessionToken = await sign(
        {
          sub: user.email,
          iat,
          exp: iat + ms(options.jwt.sessionExpiresIn),
          aud: 'session',
        },
        secret,
        { algorithm: options.jwt.algorithm as Algorithm },
      );
      const refreshToken = await sign(
        {
          sub: user.email,
          iat,
          exp: iat + ms(options.jwt.refreshExpiresIn),
          aud: 'refresh',
        },
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

  done();
};

export default fastifyPlugin(auth, { name: 'auth-plugin' });
