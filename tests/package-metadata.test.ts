import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..');
const packageJson: unknown = JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8'));

describe('package metadata', () => {
    it('is publishable as the maw-cli package', () => {
        expect(packageJson).toMatchObject({
            name: 'maw-cli',
            main: './dist/index.js',
            types: './dist/index.d.ts',
            bin: {
                'maw-cli': './bin/maw-cli.js',
            },
            files: ['bin', 'dist', 'README.md'],
            exports: {
                '.': {
                    import: './dist/index.js',
                    types: './dist/index.d.ts',
                },
                './package.json': './package.json',
            },
        });
    });

    it('ships prebuilt output without a consumer prepare hook', () => {
        expect(packageJson).not.toMatchObject({
            scripts: expect.objectContaining({
                prepare: expect.anything(),
            }),
        });
    });

    it('declares langgraph-cli as a runtime dependency', () => {
        expect(packageJson).toMatchObject({
            dependencies: {
                '@langchain/langgraph-cli': '^1.1.17',
            },
        });
    });
});
