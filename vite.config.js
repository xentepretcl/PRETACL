import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // firestore is lazy-loaded on demand (login/wishlist), not part of initial load
    chunkSizeWarningLimit: 600,
  },
})
