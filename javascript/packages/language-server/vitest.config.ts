import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'bin/',
        '**/*.d.ts',
        '**/*.config.*',
        'test/**',
        'tests/**',
        '**/*.test.*',
        '**/*.spec.*'
      ]
    }
  },
  resolve: {
    alias: {
      '@herb-tools/node-wasm': path.resolve(__dirname, 'test/__mocks__/@herb-tools/node-wasm.ts')
    }
  }
})
