import StrongConfig from '@strong-config/node';

import type { Config } from '../config/config.d.ts';

if (process.argv.some((arg) => arg.includes('test'))) {
  process.env.NODE_ENV = 'test';
} else {
  process.env.NODE_ENV ??= 'development';
}

const strongConfig = new StrongConfig();

const config = strongConfig.getConfig() as unknown as Config;

export default config;
