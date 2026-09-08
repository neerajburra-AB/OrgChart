import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves this app from a /OrgChart/ sub-path (project-pages URL pattern:
// <user>.github.io/<repo>/), so every asset URL needs that prefix baked in at build time.
// Cloudflare Pages serves from its own domain root instead, so it needs base '/' - a
// build made for one host 404s on all its JS/CSS/images if deployed to the other.
// `vite build --mode cloudflare` (see the "build:cloudflare" script in package.json)
// switches this; the default `vite build` used by the existing GitHub Pages deploy
// (npm run deploy) is untouched.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'cloudflare' ? '/' : '/OrgChart/'
}))
