import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  plugins: [preact(), basicSsl()],
  server: {
    host: true,
    port: 5173,
  },
});
