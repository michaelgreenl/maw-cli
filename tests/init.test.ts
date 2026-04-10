import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runInit } from '../src/commands/init.js';

const roots: string[] = [];

const createWorkflow = async (root: string): Promise<void> => {
    const dir = join(root, 'node_modules', 'docs-agent');

    await mkdir(dir, { recursive: true });
    await writeFile(
        join(dir, 'package.json'),
        JSON.stringify({
            name: 'docs-agent',
            type: 'module',
            exports: {
                './package.json': './package.json',
                './scaffold': './scaffold.js',
            },
        }),
    );
    await writeFile(
        join(dir, 'scaffold.js'),
        [
            'export const scaffold = {',
            '  packageName: "docs-agent",',
            '  directories: [".maw/templates"],',
            '  assets: {',
            '    config: { source: "config", target: ".maw/config.json" },',
            '    ov: { source: "ov", target: ".maw/ov.conf" },',
            '    graph: { source: "graph", target: ".maw/graph.ts" },',
            '  },',
            '  gitignore: [".maw/config.json", ".maw/ov.conf"],',
            '  rules: { overwrite: "preserve", gitignoreMerge: "append-once" },',
            '};',
            '',
            'export const createScaffoldFiles = () => ({',
            '  ".maw/config.json": JSON.stringify({ llm: { apiKey: "${OPENAI_API_KEY}" } }, null, 2),',
            '  ".maw/ov.conf": JSON.stringify({ embedding: { dense: { api_key: "${OPENAI_API_KEY}" } } }, null, 2),',
            '  ".maw/graph.ts": "import { createGraph } from \'docs-agent\';\\n\\nexport const graph = createGraph();\\n",',
            '});',
            '',
        ].join('\n'),
    );
};

const createProject = async (): Promise<string> => {
    const root = await mkdtemp(join(tmpdir(), 'maw-cli-init-'));
    roots.push(root);

    await writeFile(
        join(root, 'package.json'),
        JSON.stringify({
            name: 'target-project',
            private: true,
            dependencies: {
                'docs-agent': 'file:../docs-agent',
            },
        }),
    );
    await createWorkflow(root);

    return root;
};

describe('maw-cli init', () => {
    afterEach(async () => {
        await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
    });

    it('creates the phase 2c scaffold in the target project', async () => {
        const root = await createProject();

        await expect(runInit([], root)).resolves.toBe(0);

        expect(await readFile(join(root, '.maw/config.json'), 'utf8')).toContain('${OPENAI_API_KEY}');
        expect(await readFile(join(root, '.maw/ov.conf'), 'utf8')).toContain('${OPENAI_API_KEY}');
        expect(await readFile(join(root, '.maw/graph.ts'), 'utf8')).toContain(
            "import { createGraph } from 'docs-agent';",
        );
        expect(await readFile(join(root, '.gitignore'), 'utf8')).toBe('.maw/config.json\n.maw/ov.conf\n');
        await expect(readFile(join(root, '.maw/templates'), 'utf8')).rejects.toThrow();
    });

    it('preserves existing scaffold files and merges gitignore entries once', async () => {
        const root = await createProject();

        await writeFile(join(root, '.gitignore'), 'node_modules/\n');
        await expect(runInit([], root)).resolves.toBe(0);
        await writeFile(join(root, '.maw/graph.ts'), '// custom graph\n');

        await expect(runInit([], root)).resolves.toBe(0);

        expect(await readFile(join(root, '.maw/graph.ts'), 'utf8')).toBe('// custom graph\n');
        expect(await readFile(join(root, '.gitignore'), 'utf8')).toBe(
            'node_modules/\n.maw/config.json\n.maw/ov.conf\n',
        );
    });

    it('fails when no installed workflow package exposes the scaffold contract', async () => {
        const root = await mkdtemp(join(tmpdir(), 'maw-cli-init-empty-'));
        roots.push(root);

        await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'target-project', private: true }));

        await expect(runInit([], root)).resolves.toBe(1);
    });
});
