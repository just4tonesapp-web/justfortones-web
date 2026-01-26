// vite.config.js
import { defineConfig } from 'vite'

export default defineConfig({
  // 注意：这里左右都要有斜杠
  // 如果你的仓库叫 justfortones-web，这里就填 '/justfortones-web/'
  base: '/justfortones-web/', 
  build: {
    outDir: 'dist'
  }
})