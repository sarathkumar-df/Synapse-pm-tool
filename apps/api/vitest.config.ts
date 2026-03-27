import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    env: {
      JWT_SECRET: 'test-secret-at-least-32-characters-long-for-vitest',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/synapse_test',
      NODE_ENV: 'test',
    },
  },
  resolve: {
    alias: {
      '@synapse/shared': path.resolve(__dirname, '../../packages/shared/src/types/index.ts'),
    },
  },
})
