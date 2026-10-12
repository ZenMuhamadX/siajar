import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Host default sengaja hanya localhost supaya dev server tidak terekspos ke
// jaringan sekolah. Butuh akses dari perangkat lain? jalankan:
//   HOST=0.0.0.0 bun run dev
const host = process.env.HOST || '127.0.0.1'

// https://vite.dev/config/
export default defineConfig({
  // Path aset dibuat relatif ('./assets/...') supaya bundle yang sama bisa
  // dilayani dari root domain (web) maupun dari protokol kustom `app://local`
  // di SIAJAR Desktop. Tanpa ini, aset absolut `/assets/...` gagal dimuat
  // ketika aplikasi tidak berada tepat di root.
  base: './',
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
