import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'xeplr-ui-table': path.resolve(__dirname, '../src/index.js')
    },
    // Ensure imports from parent src/ resolve against demo's node_modules
    dedupe: ['react', 'react-dom', '@tanstack/react-table']
  },
  optimizeDeps: {
    include: ['@tanstack/react-table']
  }
})
