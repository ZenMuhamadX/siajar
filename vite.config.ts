import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Host default sengaja hanya localhost supaya dev server tidak terekspos ke
// jaringan sekolah. Butuh akses dari perangkat lain? jalankan:
//   HOST=0.0.0.0 bun run dev
const host = process.env.HOST || '127.0.0.1'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    host,
    port: 9090,
  },
  preview: {
    host,
    port: 9090,
  },
})
