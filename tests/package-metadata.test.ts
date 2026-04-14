import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..');
const packageJson = JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8')) as Record<string, unknown>;

describe('package metadata', () => {
    it('is publishable as the maw-cli package', () => {
        expect(packageJson.name).toBe('maw-cli');
        expect(packageJson.main).toBe('./dist/index.js');
        expect(packageJson.types).toBe('./dist/index.d.ts');
        expect(packageJson.bin).toEqual({
            'maw-cli': './bin/maw-cli.js',
        });
        expect(packageJson.files).toEqual(['bin', 'dist', 'README.md']);
        expect(packageJson.exports).toEqual({
            '.': {
                import: './dist/index.js',
                types: './dist/index.d.ts',
            },
            './package.json': './package.json',
        });
    });

    it('ships prebuilt output without a consumer prepare hook', () => {
        expect(packageJson.scripts).not.toHaveProperty('prepare');
    });

    it('declares langgraph-cli as a runtime dependency', () => {
        expect(packageJson.dependencies).toMatchObject({
            '@langchain/langgraph-cli': '^1.1.17',
        });
    });
});
