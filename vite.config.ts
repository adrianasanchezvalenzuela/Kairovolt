import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { kairovoltApi } from './server/vite-plugin';

export default defineConfig({
  plugins: [react(), kairovoltApi()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'lucide-react'],
  },
  test: { environment: 'node', include: ['src/**/*.test.ts', 'server/**/*.test.ts', 'supabase/**/*.test.ts'] },
});
