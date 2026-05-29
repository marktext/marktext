import { defineConfig } from 'vite';

export default defineConfig({
    root: 'host',
    server: {
        port: 5174,
        strictPort: true,
    },
    optimizeDeps: {
        exclude: ['intl-segmenter-polyfill'],
    },
});
