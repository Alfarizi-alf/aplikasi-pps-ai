import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  // Konfigurasi ini memberitahu Vite path yang benar untuk GitHub Pages
  base: '/aplikasi-pps-ai/',
  
  // Plugin untuk mengaktifkan dukungan React
  plugins: [react()],
})
