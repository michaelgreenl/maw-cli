import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createWorkflowLanggraphJson, ensureWorkflowFiles } from '../src/utils/langgraph.js';
import { cleanupRoots, createRoot } from './support.js';

describe('langgraph helpers', () => {
    afterEach(async () => {
        await cleanupRoots();
    });

    it('creates workflow-local langgraph config without root dependencies', () => {
        const cfg = createWorkflowLanggraphJson('docs-agent');

        expect(cfg).toEqual({
            node_version: '20',
            graphs: {
                'docs-agent': './graph.ts:graph',
            },
            env: '../../../.env',
        });
        expect(cfg).not.toHaveProperty('dependencies');
    });

    it('validates required workflow-local files before launch', async () => {
        const root = await createRoot('maw-cli-langgraph-');
        const dir = join(root, '.maw/graphs/docs-agent');

        await mkdir(dir, { recursive: true });
        await writeFile(join(dir, 'graph.ts'), 'export const graph = {}\n');
        await writeFile(join(dir, 'config.json'), '{}\n');

        await expect(ensureWorkflowFiles(dir)).rejects.toThrow(
            `Workflow file not found: ${join(dir, 'langgraph.json')}`,
        );

        await writeFile(join(dir, 'langgraph.json'), '{}\n');

        await expect(ensureWorkflowFiles(dir)).resolves.toBeUndefined();
    });
});
