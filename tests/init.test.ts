import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadWorkflows, runInit } from '../src/commands/init.js';
import { cleanupRoots, createProject, createRoot, writePackage } from './support.js';

const readJson = async <T>(file: string): Promise<T> => {
    return JSON.parse(await readFile(file, 'utf8')) as T;
};

describe('maw-cli init', () => {
    afterEach(async () => {
        await cleanupRoots();
    });

    it('loads every workflow package sorted by workflow name', async () => {
        const root = await createProject('maw-cli-workflows-', ['docs-agent', 'code-agent']);

        const workflows = await loadWorkflows(root);

        expect(workflows.map((workflow) => workflow.scaffold)).toEqual([
            { packageName: 'code-agent', workflow: 'code-agent' },
            { packageName: 'docs-agent', workflow: 'docs-agent' },
        ]);
        await expect(Promise.resolve(workflows[0].createScaffoldFiles())).resolves.toEqual({
            'config.json': JSON.stringify({ agents: { coder: { skills: ['general-coding'] } } }, null, 2),
            'graph.ts': "import { createGraph } from 'code-agent';\n\nexport const graph = createGraph();\n",
        });
    });

    it('returns an empty list when no workflow packages expose the scaffold contract', async () => {
        const root = await createRoot('maw-cli-workflows-empty-');

        await writePackage(root);

        await expect(loadWorkflows(root)).resolves.toEqual([]);
    });

    it('fails when two packages claim the same workflow name', async () => {
        const root = await createProject('maw-cli-workflows-dup-', ['docs-agent', 'docs-agent-alt']);

        await expect(loadWorkflows(root)).rejects.toThrow('Duplicate workflow name: docs-agent');
    });

    it('creates maw-cli-owned project scaffold files and directories', async () => {
        const root = await createProject('maw-cli-init-', ['docs-agent']);

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
        const root = await createProject('maw-cli-init-preserve-', ['docs-agent']);

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
        const root = await createRoot('maw-cli-init-empty-');

        await writePackage(root);

        await expect(runInit([], root)).resolves.toBe(1);
    });
});
