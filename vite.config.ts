import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'web',
  plugins: [react()],
  build: { outDir: '../dist/web', emptyOutDir: true },
  server: { port: 5173, proxy: { '/api': 'http://localhost:8787' } },
  preview: { port: 4173, proxy: { '/api': 'http://localhost:8787' } },
});
