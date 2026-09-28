import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { tableDuMj } from './scripts/vite-plugin-mj.js'

// base relative : le site fonctionne sous https://<compte>.github.io/<depot>/
export default defineConfig({
  base: './',
  plugins: [vue(), tableDuMj()],
  test: { include: ['tests/**/*.test.js'] },
})
