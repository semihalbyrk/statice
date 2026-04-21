import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    strictPort: true,
  },
  test: {
    // Exclude Playwright E2E tests (renamed to .playwright.js) and node_modules
    exclude: ['**/__tests__/e2e/**', '**/node_modules/**'],
  },
});
