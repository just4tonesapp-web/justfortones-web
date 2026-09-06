import { defineConfig } from 'vite'

export default defineConfig({
  // Vercel serves from the domain root; GitHub Pages from /<repo-name>/.
  // Vercel sets VERCEL=1 during builds, so both keep working in transition.
  base: process.env.VERCEL ? '/' : '/justfortones-web/',
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC'),
  },
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
