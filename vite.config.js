import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the static build works from any Netlify path.
  base: './',
  // host: true exposes the dev server on your LAN so you can test on a real phone.
  server: { host: true, port: 5173 },
  build: { chunkSizeWarningLimit: 2000 },
});
