import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: '../decks',
  server: { fs: { allow: ['..'] } },
});
