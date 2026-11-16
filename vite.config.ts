import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const rutaCero = (process.env.SYSTEAM_APP_KIND || env.SYSTEAM_APP_KIND) === 'ruta-cero';
  return {
    plugins: [
      react(),
      tailwindcss(),
      ...(rutaCero ? [{
        name: 'ruta-cero-page-title',
        transformIndexHtml: {
          order: 'pre' as const,
          handler: (html: string) => html
            .replace('<html lang="en">', '<html lang="es" data-app="ruta-cero">')
            .replace(/<title>.*?<\/title>/i, '<title>Ruta Cero · Portal del programa</title>')
            .replace(/<link rel="icon"[^>]*>/i, '<link rel="icon" type="image/svg+xml" href="/src/assets/ruta-cero-icon.svg" />'),
        },
      }] : []),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        ...(rutaCero && { './App.tsx': path.resolve(__dirname, 'src/RutaCeroApp.tsx') }),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
