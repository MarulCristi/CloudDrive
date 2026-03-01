import { defineConfig } from 'vitest/config';
export default defineConfig({
    test: {
        environment: 'node',
        globals: true,
        setupFiles: './src/setupTests.ts'
    }
});
//# sourceMappingURL=vitest.config.js.map