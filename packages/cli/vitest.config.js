import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: [
        'src/spec/schema.js',
        'src/executor/topoSort.js',
        'src/executor/nodeHandlers/video-stitcher.js',
        'src/executor/nodeHandlers/input-folder.js',
        'src/executor/nodeHandlers/input-file.js'
      ],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100
      }
    }
  }
})
