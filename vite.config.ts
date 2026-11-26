import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the site works under https://<user>.github.io/meiro-chat/.
  base: './',
  build: {
    rollupOptions: {
      input: { index: 'index.html', overlay: 'overlay.html' },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
