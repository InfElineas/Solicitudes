import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React + UI libraries que dependen de React van juntos para evitar ciclos
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react-router') ||
            id.includes('node_modules/scheduler/') ||
            id.includes('node_modules/sonner/') ||
            id.includes('node_modules/lucide-react/') ||
            id.includes('node_modules/@radix-ui/')
          ) return 'vendor-react-ui';

          if (id.includes('node_modules/@tanstack/')) return 'vendor-query';
          if (id.includes('node_modules/@supabase/') || id.includes('node_modules/ws/')) return 'vendor-supabase';
          if (id.includes('node_modules/recharts/') || id.includes('node_modules/d3') || id.includes('node_modules/victory')) return 'vendor-charts';
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
})
