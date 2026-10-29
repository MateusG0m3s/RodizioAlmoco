import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// `npm run dev:emulators`: a CSP do index.html precisa liberar o Auth (9099) e o Realtime Database (9000) locais
const EMULATOR_ORIGINS = 'http://127.0.0.1:9099 http://127.0.0.1:9000 ws://127.0.0.1:9000'
const emulatorCsp = () => ({
  name: 'csp-emuladores',
  transformIndexHtml: (html) =>
    html.replace('connect-src ', `connect-src ${EMULATOR_ORIGINS} `).replace('frame-src ', `frame-src ${EMULATOR_ORIGINS} `),
})

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'emulators' ? [emulatorCsp()] : [])],
  base: process.env.NODE_ENV === 'production' ? '/RodizioAlmoco/' : '/',
}))
