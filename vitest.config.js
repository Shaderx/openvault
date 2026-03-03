import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    test: {
        environment: 'jsdom',
        globals: true,
        include: ['tests/**/*.test.js'],
        setupFiles: ['./tests/setup.js'],
    },
    resolve: {
        alias: {
            // Map SillyTavern extension dependencies to test stubs
            '../../../../extensions.js': path.resolve(__dirname, 'tests/stubs/extensions.js'),
            '../../../../../extensions.js': path.resolve(__dirname, 'tests/stubs/extensions.js'),
            '../../../../../../extensions.js': path.resolve(__dirname, 'tests/stubs/extensions.js'),
            '../../../../../script.js': path.resolve(__dirname, 'tests/stubs/extensions.js'),
            '../../../../../../script.js': path.resolve(__dirname, 'tests/stubs/extensions.js'),
            '../../../shared.js': path.resolve(__dirname, 'tests/stubs/shared.js'),
            // Map https://esm.sh/zod@4 to local zod package for tests
            'https://esm.sh/zod@4': path.resolve(__dirname, 'node_modules/zod'),
            // Map https://esm.sh/snowball-stemmers@0.6.0 to local package for tests
            'https://esm.sh/snowball-stemmers@0.6.0': path.resolve(__dirname, 'node_modules/snowball-stemmers'),
            // Map https://esm.sh/jsonrepair to local package for tests
            'https://esm.sh/jsonrepair': path.resolve(__dirname, 'node_modules/jsonrepair'),
            // Map https://esm.sh/graphology to local package for tests
            'https://esm.sh/graphology@0.25.4': path.resolve(__dirname, 'node_modules/graphology'),
            'https://esm.sh/graphology-communities-louvain@0.12.0': path.resolve(
                __dirname,
                'node_modules/graphology-communities-louvain'
            ),
            'https://esm.sh/graphology-operators@1.6.0': path.resolve(__dirname, 'node_modules/graphology-operators'),
        },
    },
});
