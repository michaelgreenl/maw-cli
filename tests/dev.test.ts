import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runDev } from '../src/commands/dev.js';
import { LANGGRAPH_JSON } from '../src/utils/langgraph.js';
import { captureStderr, cleanupRoots, createRoot, writeConfig } from './support.js';

describe('runDev', () => {
    afterEach(async () => {
        vi.restoreAllMocks();
        await cleanupRoots();
    });

    it('returns 1 and writes to stderr when .maw/config.json is missing', async () => {
        const root = await createRoot('maw-cli-dev-missing-');
        const launch = vi.fn(async () => 0);
        const stderr = captureStderr();

        await expect(runDev([], root, launch)).resolves.toBe(1);
        expect(launch).not.toHaveBeenCalled();
        expect(stderr.output.join('')).toContain('Config file not found');
        stderr.restore();
    });

    it('writes a correctly shaped langgraph.json when the file does not exist', async () => {
        const root = await createRoot('maw-cli-dev-write-');
        await writeConfig(root);

        await expect(runDev([], root, async () => 0)).resolves.toBe(0);

        const cfg = JSON.parse(await readFile(join(root, 'langgraph.json'), 'utf8')) as typeof LANGGRAPH_JSON;

        expect(cfg).toEqual(LANGGRAPH_JSON);
    });

    it('does not resolve config env vars before launching langgraph', async () => {
        const root = await createRoot('maw-cli-dev-env-');
        await writeConfig(root);
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
