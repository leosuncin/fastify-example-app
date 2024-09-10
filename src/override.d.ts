declare module NodeJS {
  interface ProcessEnv {
    PORT?: string;
    NODE_ENV: 'development' | 'production' | 'test';
  }
}
