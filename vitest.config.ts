import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      vscode: fileURLToPath(new URL('./src/__mocks__/vscode.ts', import.meta.url)),
    },
  },
  test: {
    resetMocks: true,
    include: ['src/__tests__/**/*.test.ts'],
  },
});
