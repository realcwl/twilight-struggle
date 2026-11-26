import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5173, strictPort: false },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
    // two pages: the map sandbox (index.html) and the play screen (game.html)
    rollupOptions: { input: { index: 'index.html', game: 'game.html', online: 'online.html' } },
  },
});
