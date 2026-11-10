import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    allowedHosts: true
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-supabase': ['@supabase/supabase-js']
        }
      }
    }
  }
});
