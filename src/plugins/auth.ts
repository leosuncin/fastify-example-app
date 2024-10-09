import { Algorithm, sign, verify } from '@node-rs/jsonwebtoken';
import type {
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
type VerifyResult<T> =
  | {
      valid: true;
      value: T;
      renew: boolean;
    }
  | {
      valid: false;
      value: Error;
      renew: false;
    };

export const SESSION_COOKIE_NAME = 'SESSION_TOKEN';
export const REFRESH_COOKIE_NAME = 'REFRESH_TOKEN';

function signSession(options: Config['jwt'], user: SessionPayload['usr']) {
  const [key] = options.jwtSecret;
  const algorithm = options.algorithm as Algorithm;
  const iat = Date.now();

  if ('password' in user) {
    delete user.password;
  }

  const claims: SessionPayload = {
    sub: 'authenticate',
    iat,
    exp: iat + ms(options.sessionExpiresIn),
    aud: 'session',
    usr: user,
  };

  return sign(claims, key, { algorithm });
}

function signRefresh(options: Config['jwt'], uid: User['id']) {
  const [key] = options.jwtSecret;
  const algorithm = options.algorithm as Algorithm;
  const iat = Date.now();

  const claims: RefreshPayload = {
    sub: 'refresh',
    iat,
    exp: iat + ms(options.refreshExpiresIn),
    aud: 'session',
    uid,
  };

  return sign(claims, key, { algorithm });
}

async function verifySession(
  options: Config['jwt'],
  token: string,
): Promise<VerifyResult<SessionPayload>> {
  const algorithm = options.algorithm as Algorithm;

  for (const key of options.jwtSecret) {
    try {
      const value = (await verify(token, key, {
        algorithms: [algorithm],
        sub: 'authenticate',
        aud: ['session'],
        requiredSpecClaims: ['aud', 'exp', 'sub'],
      })) as SessionPayload;

      return {
        valid: true,
        value,
        renew: key !== options.jwtSecret[0],
      };
    } catch (error) {
      if (error instanceof Error && error.message === 'InvalidSignature') {
        // Try the next secret
        continue;
      }

      return {
        valid: false,
        value: new Error('Invalid session token', { cause: error }),
        renew: false,
      };
    }
  }

  return {
    valid: false,
    value: new Error('Invalid session token'),
    renew: false,
  };
}

async function verifyRefresh(
  options: Config['jwt'],
  token: string,
): Promise<VerifyResult<RefreshPayload>> {
  const algorithm = options.algorithm as Algorithm;

  for (const key of options.jwtSecret) {
    try {
      const value = (await verify(token, key, {
        algorithms: [algorithm],
        sub: 'refresh',
        aud: ['session'],
        requiredSpecClaims: ['aud', 'exp', 'sub'],
      })) as RefreshPayload;

      return {
        valid: true,
        value,
        renew: key !== options.jwtSecret[0],
      };
    } catch (error) {
      if (error instanceof Error && error.message === 'InvalidSignature') {
        // Try the next secret
        continue;
      }

      return {
        valid: false,
        value: new Error('Invalid refresh token', { cause: error }),
        renew: false,
      };
    }
  }

  return {
    valid: false,
    value: new Error('Invalid refresh token'),
    renew: false,
  };
}

const auth: FastifyPluginCallback<Config> = (
  fastify: FastifyInstance,
  options,
  done,
) => {
  fastify.decorateReply(
    'setAuthenticationTokens',
    async function setAuthenticationTokens(
      user: Omit<User, 'password'>,
      refresh = true,
    ) {
      const sessionToken = await signSession(options.jwt, user);
      this.setCookie(SESSION_COOKIE_NAME, sessionToken, {
        maxAge: ms(options.jwt.sessionExpiresIn) / 1_000,
      });

      if (!refresh) {
        return;
      }

      const refreshToken = await signRefresh(options.jwt, user.id);
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

      const sessionPayload = await verifySession(
        options.jwt,
        sessionToken.value,
      );
      // @ts-expect-error value is an Error if valid is false
      fastify.assert(sessionPayload.valid, 401, sessionPayload.value.message);

      request.user = sessionPayload.value.usr;
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

  fastify.decorate(
    'verifyRefreshToken',
    async function verifyRefreshToken(request: FastifyRequest) {
      const { [REFRESH_COOKIE_NAME]: refreshCookie } = request.cookies;

      fastify.assert(refreshCookie, 401, 'A refresh cookie is required');
      const refreshToken = request.unsignCookie(refreshCookie);

      fastify.assert(refreshToken.valid, 401, 'Invalid refresh cookie');

      const refreshPayload = await verifyRefresh(
        options.jwt,
        refreshToken.value,
      );
      // @ts-expect-error value is an Error if valid is false
      fastify.assert(refreshPayload.valid, 401, refreshPayload.value.message);

      request.user = { id: refreshPayload.value.uid };
    },
  );

  done();
};

export default fastifyPlugin(auth, { name: 'auth-plugin' });
