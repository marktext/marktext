import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['test/inline-spec/**/*.spec.ts'],
        environment: 'happy-dom',
    },
});
