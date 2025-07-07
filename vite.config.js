import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  // Ganti 'NAMA_REPOSITORI_ANDA' dengan nama repositori GitHub Anda
  base: '/NAMA_REPOSITORI_ANDA/', 
  plugins: [react()],
})
