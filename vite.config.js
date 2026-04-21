import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    {
      name: 'remove-evals',
      transform(code, id) {
        if (id.includes('onnxruntime') || id.includes('transformers')) {
          // Remove all eval patterns for CSP compliance
          code = code.replace(/eval\(['"]this['"]\)/g, "globalThis");
          code = code.replace(/new Function\(['"]return this['"]\)\(\)/g, "globalThis");
          code = code.replace(/eval\(/g, "(function(){return globalThis})(");
          return code;
        }
      }
    }
  ],
  build: {
    target: 'esnext',
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      // ES module entry points only. Content scripts are in public/ (copied as-is).
      input: {
        background: "src/background.js",
        offscreen: "src/offscreen.js",
        worker: "src/module1_engine/worker.js",
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        format: 'es'
      }
    }
  }
});
