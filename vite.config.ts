import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  const pages = mode === 'pages';
  return {
    base: pages ? '/twilight/' : '/',
    define: pages ? {
      'import.meta.env.VITE_ROOM_API_ORIGIN': JSON.stringify(
        process.env.VITE_ROOM_API_ORIGIN || 'https://coldwar-duel.coldwar-table-0931.workers.dev',
      ),
    } : {},
    server: { port: 5173, strictPort: false },
    build: {
      outDir: pages ? 'dist-pages' : 'dist',
      target: 'es2022',
      chunkSizeWarningLimit: 900,
      rollupOptions: { input: pages ? ['online.html', 'game.html'] : ['index.html', 'online.html', 'game.html'] },
    },
  };
});
