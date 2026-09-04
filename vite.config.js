import { defineConfig } from 'vite'

export default defineConfig({
  // Vercel serves from the domain root; GitHub Pages from /<repo-name>/.
  // Vercel sets VERCEL=1 during builds, so both keep working in transition.
  base: process.env.VERCEL ? '/' : '/justfortones-web/',
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
