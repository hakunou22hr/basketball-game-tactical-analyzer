import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/basketball-game-tactical-analyzer/',
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['basketball.svg'],
    manifest: {
      name: 'Basketball Game Tactical Analyzer', short_name: 'Tactical Analyzer',
      description: '映像とデータで、次の一手を見つける', theme_color: '#08111f', background_color: '#08111f',
      display: 'standalone', start_url: '/basketball-game-tactical-analyzer/',
      icons: [{ src: 'basketball.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }]
    }
  })]
})
