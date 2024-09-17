import { Algorithm, sign } from '@node-rs/jsonwebtoken';
import ms from 'ms';

import config from '../config.js';

export async function generateTokens(user: {
  email: string;
  [key: string]: unknown;
}): Promise<[sessionToken: string, refreshToken: string]> {
  const iat = Date.now();
  const secret = config.jwt.jwtSecret.at(-1)!;

  const sessionToken = await sign(
    {
      sub: user.email,
      iat,
      exp: iat + ms(config.jwt.sessionExpiresIn),
      aud: 'session',
    },
    secret,
    { algorithm: config.jwt.algorithm as Algorithm },
  );
  const refreshToken = await sign(
    {
      sub: user.email,
      iat,
      exp: iat + ms(config.jwt.refreshExpiresIn),
      aud: 'refresh',
    },
    secret,
    { algorithm: config.jwt.algorithm as Algorithm },
  );

  return [sessionToken, refreshToken];
}
