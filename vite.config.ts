import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const isProduction = mode === 'production';
  return {
    base: isProduction ? '/Connect/' : '/',
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is managed by the dev environment.
      // Do not modify—file watching is configured for optimal performance.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
/* 
  Copyright (c) 2026 Rascales dev under teched studios. 
  All rights reserved.
*/
  };
});
