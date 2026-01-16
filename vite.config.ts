import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        open: true,
        host: true,
        port: 5173,
        hmr: {
            // Disable HMR in production builds to prevent WebSocket connection errors
            clientPort: process.env.NODE_ENV === 'production' ? 443 : 5173,
            overlay: false, // Disable error overlay to prevent stale errors
        },
    },
    build: {
        // Ensure production builds don't try to connect to dev server
        sourcemap: false,
    },
});
