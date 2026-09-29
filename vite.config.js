import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// En local, l'API tourne à part (npm run dev:api) : Vite lui transmet tout ce qui commence par /api.
const versApi = { '/api': { target: 'http://localhost:3000' } }

export default defineConfig({
  base: '/',
  plugins: [vue()],
  server: { proxy: versApi },
  preview: { proxy: versApi },
  test: { include: ['tests/**/*.test.js'] },
})
