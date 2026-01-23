import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          // Binance Spot API proxy
          '/binance-spot': {
            target: 'https://api.binance.com',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/binance-spot/, ''),
            secure: true,
          },
          // Binance Futures API proxy
          '/binance-futures': {
            target: 'https://fapi.binance.com',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/binance-futures/, ''),
            secure: true,
          }
        }
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});