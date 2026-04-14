import { afterEach, describe, expect, it, vi } from 'vitest';
import { runStart } from '../src/commands/start.js';
import { captureStderr, cleanupRoots, createRoot, writeConfig } from './support.js';

describe('runStart', () => {
    afterEach(async () => {
        vi.restoreAllMocks();
        await cleanupRoots();
    });

    it('returns 1 and writes to stderr when .maw/config.json is missing', async () => {
        const root = await createRoot('maw-cli-start-missing-');
        const launch = vi.fn(async () => 0);
        const stderr = captureStderr();

        await expect(runStart([], root, launch)).resolves.toBe(1);
        expect(launch).not.toHaveBeenCalled();
        expect(stderr.output.join('')).toContain('Config file not found');
        stderr.restore();
    });

    it('calls launch with start args when config is valid', async () => {
        const root = await createRoot('maw-cli-start-launch-');
        await writeConfig(root);
        const launch = vi.fn(async () => 0);

        await expect(runStart(['--host', '0.0.0.0'], root, launch)).resolves.toBe(0);

        expect(launch).toHaveBeenCalledWith('start', ['--host', '0.0.0.0']);
    });
});
