import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runDev } from '../src/commands/dev.js';
import { captureStderr, cleanupRoots, createRoot, writeConfig } from './support.js';

describe('runDev', () => {
    afterEach(async () => {
        vi.restoreAllMocks();
        await cleanupRoots();
    });

    it('returns 1 and writes to stderr when maw.json is missing', async () => {
        const root = await createRoot('maw-cli-dev-missing-');
        const launch = vi.fn(async () => 0);
        const stderr = captureStderr();

        await expect(runDev([], root, launch)).resolves.toBe(1);
        expect(launch).not.toHaveBeenCalled();
        expect(stderr.output.join('')).toContain('Config file not found');
        stderr.restore();
    });

    it('returns 1 and does not launch when maw.json is malformed', async () => {
        const root = await createRoot('maw-cli-dev-invalid-');
        await writeConfig(root, {
            workspace: '.',
            openviking: { enabled: true, host: 'localhost' },
            templates: { customPath: '.maw/templates' },
        });
        const launch = vi.fn(async () => 0);
        const stderr = captureStderr();

        await expect(runDev([], root, launch)).resolves.toBe(1);

        expect(launch).not.toHaveBeenCalled();
        expect(stderr.output.join('')).toContain('Invalid config: missing openviking.port');
        stderr.restore();
    });

    it('writes a correctly shaped langgraph.json when the file does not exist', async () => {
        const root = await createRoot('maw-cli-dev-write-');
        await writeConfig(root);

        await expect(runDev([], root, async () => 0)).resolves.toBe(0);

        const cfg = JSON.parse(await readFile(join(root, 'langgraph.json'), 'utf8')) as Record<string, unknown>;

        expect(cfg).toEqual({
            node_version: '20',
            graphs: {
                agent: './.maw/graph.ts:graph',
            },
            env: '.env',
            dependencies: ['.'],
        });
    });

    it('treats env-like config strings as literal values before launching langgraph', async () => {
        const root = await createRoot('maw-cli-dev-env-');
        await writeConfig(root, {
            workspace: '.',
            openviking: { enabled: true, host: '${MAW_CONFIG_HOST}', port: 1933 },
            templates: { customPath: '${MAW_CONFIG_PATH}' },
        });
        const launch = vi.fn(async () => 0);
        const stderr = captureStderr();

        await expect(runDev([], root, launch)).resolves.toBe(0);

        expect(launch).toHaveBeenCalledWith('dev', []);
        expect(stderr.output.join('')).toBe('');
        stderr.restore();
    });

    it('does not overwrite an existing langgraph.json', async () => {
        const root = await createRoot('maw-cli-dev-preserve-');
        await writeConfig(root);
        await writeFile(join(root, 'langgraph.json'), '{\n  "custom": true\n}\n');

        await expect(runDev([], root, async () => 0)).resolves.toBe(0);

        expect(await readFile(join(root, 'langgraph.json'), 'utf8')).toBe('{\n  "custom": true\n}\n');
    });

    it('calls launch with dev args when config is valid', async () => {
        const root = await createRoot('maw-cli-dev-launch-');
        await writeConfig(root);
        const launch = vi.fn(async () => 0);

        await expect(runDev(['--port', '2024'], root, launch)).resolves.toBe(0);

        expect(launch).toHaveBeenCalledWith('dev', ['--port', '2024']);
    });
});
