import StrongConfig from '@strong-config/node';
import { defineConfig } from 'drizzle-kit';

process.env.NODE_ENV ??= 'development';

const loader = new StrongConfig();

const config = loader.getConfig()

export default defineConfig({
  schema: "./src/schema/index.ts",
  dialect: 'postgresql',
  out: 'migrations',
  migrations: {
    prefix: 'supabase',
  },
  dbCredentials: config.db,
})
