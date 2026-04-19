import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    // Emit files next to manifest.json in dist/
    outDir: 'dist',
    emptyOutDir: true,

    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background.js'),
      },
      output: {
        // Chrome MV3 service workers must be a single file — no chunks.
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',

        // Keep it as an ES module to match manifest "type": "module".
        format: 'es',
      },
    },

    // MV3 service workers run in a controlled context; minification is fine
    // but we disable it during development for readability.
    minify: false,
    sourcemap: true,
  },
});
