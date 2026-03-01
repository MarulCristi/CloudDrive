import { defineConfig } from 'vitest/config';
export default defineConfig({
    test: {
        environment: 'node',
        globals: true,
        exclude: ['dist/**', 'node_modules/**'],
    },
});
//# sourceMappingURL=vitest.config.js.map