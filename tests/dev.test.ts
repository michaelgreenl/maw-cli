import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runDev } from '../src/commands/dev.js';
import { captureStderr, cleanupRoots, createRoot, writeConfig } from './support.js';

const usage = 'Usage: maw-cli dev <workflow> [langgraph args...]';

const seed = async (root: string, name = 'docs-agent'): Promise<void> => {
    const dir = join(root, '.maw/graphs', name);

    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'graph.ts'), 'export const graph = {}\n');
    await writeFile(join(dir, 'config.json'), '{}\n');
    await writeFile(join(dir, 'langgraph.json'), '{}\n');
};

describe('runDev', () => {
    afterEach(async () => {
        vi.restoreAllMocks();
        await cleanupRoots();
    });

    it('returns 1 with usage when the workflow arg is missing', async () => {
        const root = await createRoot('maw-cli-dev-usage-');
        const launch = vi.fn(async () => 0);
        const stderr = captureStderr();

        await expect(runDev([], root, launch)).resolves.toBe(1);

        expect(launch).not.toHaveBeenCalled();
        expect(stderr.output.join('')).toContain(usage);
        stderr.restore();
    });

    it('returns 1 with usage when flags come before the workflow arg', async () => {
        const root = await createRoot('maw-cli-dev-flags-');
        const launch = vi.fn(async () => 0);
        const stderr = captureStderr();

        await expect(runDev(['--port', '2024'], root, launch)).resolves.toBe(1);

        expect(launch).not.toHaveBeenCalled();
        expect(stderr.output.join('')).toContain(usage);
        stderr.restore();
    });

    it('returns 1 and writes to stderr when maw.json is missing', async () => {
        const root = await createRoot('maw-cli-dev-missing-');
        const launch = vi.fn(async () => 0);
        const stderr = captureStderr();

        await seed(root);
        await expect(runDev(['docs-agent'], root, launch)).resolves.toBe(1);

        expect(launch).not.toHaveBeenCalled();
        expect(stderr.output.join('')).toContain('Config file not found');
        stderr.restore();
    });

    it('returns 1 and does not launch when maw.json is malformed', async () => {
        const root = await createRoot('maw-cli-dev-invalid-');
        await seed(root);
        await writeConfig(root, {
            workspace: '.',
            openviking: { enabled: true, host: 'localhost' },
            templates: { customPath: '.maw/templates' },
        });
        const launch = vi.fn(async () => 0);
        const stderr = captureStderr();

        await expect(runDev(['docs-agent'], root, launch)).resolves.toBe(1);

        expect(launch).not.toHaveBeenCalled();
        expect(stderr.output.join('')).toContain('Invalid config: missing openviking.port');
        stderr.restore();
    });

    it('returns 1 when the workflow directory is missing', async () => {
        const root = await createRoot('maw-cli-dev-workflow-');
        await writeConfig(root);
        const launch = vi.fn(async () => 0);
        const stderr = captureStderr();

        await expect(runDev(['docs-agent'], root, launch)).resolves.toBe(1);

        expect(launch).not.toHaveBeenCalled();
        expect(stderr.output.join('')).toContain(`Workflow directory not found: ${join(root, '.maw/graphs/docs-agent')}`);
        stderr.restore();
    });

    it('returns 1 when workflow-local files are missing', async () => {
        const root = await createRoot('maw-cli-dev-files-');
        const dir = join(root, '.maw/graphs/docs-agent');

        await writeConfig(root);
        await mkdir(dir, { recursive: true });
        await writeFile(join(dir, 'graph.ts'), 'export const graph = {}\n');
        const launch = vi.fn(async () => 0);
        const stderr = captureStderr();

        await expect(runDev(['docs-agent'], root, launch)).resolves.toBe(1);

        expect(launch).not.toHaveBeenCalled();
        expect(stderr.output.join('')).toContain(`Workflow file not found: ${join(dir, 'config.json')}`);
        stderr.restore();
    });

    it('calls launch with workflow config and forwarded args', async () => {
        const root = await createRoot('maw-cli-dev-launch-');
        await writeConfig(root);
        await seed(root);
        const launch = vi.fn(async () => 0);

        await expect(runDev(['docs-agent', '--port', '2024'], root, launch)).resolves.toBe(0);

        expect(launch).toHaveBeenCalledWith('dev', ['--config', '.maw/graphs/docs-agent', '--port', '2024']);
    });
});
