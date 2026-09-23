import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
 
  plugins: [react()],
  define: {
    // Polyfill process.env so Isoflow's internal webpack bundle doesn't choke
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
  },
  resolve: {
    dedupe: ['react', 'react-dom']
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'isoflow']
  },
  server: {
    port: 5174
  }
});