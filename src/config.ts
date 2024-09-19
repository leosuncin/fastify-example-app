import StrongConfig from '@strong-config/node';

import type { Config } from '../config/config.d.ts';

process.env['NODE_ENV'] ??= process.argv.some((arg) => arg.includes('test'))
  ? 'test'
  : 'development';

const strongConfig = new StrongConfig();

const config = strongConfig.getConfig() as unknown as Config;

export default config;
