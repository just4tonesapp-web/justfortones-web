import { defineConfig } from 'vite'

export default defineConfig({
  // Match your GitHub repo name – change if different
  base: '/justfortones-web/',
  build: {
    outDir: 'dist'
  },
  optimizeDeps: {
    // These packages use WASM/workers and must not be pre-bundled by esbuild
    exclude: ['@xenova/transformers'],
  },
  worker: {
    format: 'es',
  },
})
