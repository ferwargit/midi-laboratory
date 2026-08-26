import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    pool: 'forks',
    maxWorkers: 1,
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/renderer/src/domain/**',
        'src/renderer/src/stores/**',
        'src/renderer/src/hooks/**',
        'src/renderer/src/services/**'
      ],
      exclude: ['src/**/*.d.ts', 'src/**/types.ts', 'src/**/*Types.ts'] // 👈 Excluye interfaces puras
    }
  },
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer/src')
    }
  }
})
