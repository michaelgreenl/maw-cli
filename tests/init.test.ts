import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runInit } from '../src/commands/init.js';

const roots: string[] = [];

const readJson = async <T>(file: string): Promise<T> => {
    return JSON.parse(await readFile(file, 'utf8')) as T;
};

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
            '};',
            '',
            'export const createScaffoldFiles = () => ({',
            '  ".maw/config.json": JSON.stringify({ agents: { planner: { skills: ["general-coding"] } } }, null, 2),',
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

    it('creates maw-cli-owned project scaffold files and directories', async () => {
        const root = await createProject();

        await expect(runInit([], root)).resolves.toBe(0);

        expect(await readJson(join(root, 'maw.json'))).toEqual({
            workspace: '.',
            openviking: {
                enabled: true,
                host: 'localhost',
                port: 1933,
            },
            templates: {
                customPath: '.maw/templates',
            },
        });
        expect(await readJson(join(root, '.maw/ov.conf'))).toEqual({
            storage: {
                workspace: './.maw/openviking',
            },
            log: {
                level: 'INFO',
                output: 'stdout',
            },
            embedding: {
                dense: {
                    api_base: 'https://api.openai.com/v1',
                    api_key: '${OPENAI_API_KEY}',
                    provider: 'openai',
                    dimension: 3072,
                    model: 'text-embedding-3-large',
                },
                max_concurrent: 10,
            },
            vlm: {
                api_base: 'https://api.openai.com/v1',
                api_key: '${OPENAI_API_KEY}',
                provider: 'openai',
                model: 'gpt-4o',
                max_concurrent: 100,
            },
        });
        expect((await stat(join(root, '.maw/templates'))).isDirectory()).toBe(true);
        expect((await stat(join(root, '.maw/graphs'))).isDirectory()).toBe(true);
        expect(await readFile(join(root, '.maw/config.json'), 'utf8')).toContain('general-coding');
        expect(await readFile(join(root, '.maw/graph.ts'), 'utf8')).toContain(
            "import { createGraph } from 'docs-agent';",
        );
        expect(await readFile(join(root, '.gitignore'), 'utf8')).toBe('.maw/openviking/\n');
    });

    it('preserves project-owned files and appends only the openviking gitignore entry once', async () => {
        const root = await createProject();

        await mkdir(join(root, '.maw'), { recursive: true });
        await writeFile(join(root, 'maw.json'), '{\n  "workspace": "custom"\n}\n');
        await writeFile(join(root, '.maw/ov.conf'), '{\n  "custom": true\n}\n');
        await writeFile(join(root, '.gitignore'), 'node_modules/\n');
        await expect(runInit([], root)).resolves.toBe(0);
        await writeFile(join(root, '.maw/graph.ts'), '// custom graph\n');

        await expect(runInit([], root)).resolves.toBe(0);

        expect(await readFile(join(root, 'maw.json'), 'utf8')).toBe('{\n  "workspace": "custom"\n}\n');
        expect(await readFile(join(root, '.maw/ov.conf'), 'utf8')).toBe('{\n  "custom": true\n}\n');
        expect(await readFile(join(root, '.maw/graph.ts'), 'utf8')).toBe('// custom graph\n');
        expect(await readFile(join(root, '.gitignore'), 'utf8')).toBe('node_modules/\n.maw/openviking/\n');
    });

    it('fails when no installed workflow package exposes the scaffold contract', async () => {
        const root = await mkdtemp(join(tmpdir(), 'maw-cli-init-empty-'));
        roots.push(root);

        await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'target-project', private: true }));

        await expect(runInit([], root)).resolves.toBe(1);
    });
});
