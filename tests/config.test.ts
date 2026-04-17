import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const roots: string[] = [];

type Reader = (root: string) => Promise<unknown>;

const load = async (): Promise<Reader> => {
    const mod = await import('../src/index.js');

    expect(mod.readConfig).toBeTypeOf('function');

    return mod.readConfig;
};

const createRoot = async (): Promise<string> => {
    const root = await mkdtemp(join(tmpdir(), 'maw-cli-config-'));
    roots.push(root);
    return root;
};

const createConfig = (host = 'localhost', customPath = '.maw/templates') => ({
    workspace: '.',
    openviking: { enabled: true, host, port: 1933 },
    templates: {
        customPath,
    },
});

const writeConfigFile = async (root: string, cfg: unknown): Promise<void> => {
    await mkdir(root, { recursive: true });
    await writeFile(join(root, 'maw.json'), JSON.stringify(cfg, null, 2));
};

describe('readConfig', () => {
    afterEach(async () => {
        await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
    });

    it('reads maw.json from the public api', async () => {
        const root = await createRoot();
        const readConfig = await load();

        await writeConfigFile(root, createConfig());

        await expect(readConfig(root)).resolves.toMatchObject({
            workspace: '.',
            openviking: { enabled: true, host: 'localhost', port: 1933 },
            templates: { customPath: '.maw/templates' },
        });
    });

    it('throws when maw.json is missing', async () => {
        const root = await createRoot();
        const readConfig = await load();

        await expect(readConfig(root)).rejects.toThrow(`Config file not found: ${join(root, 'maw.json')}`);
    });

    it('treats env-like strings as literals', async () => {
        const root = await createRoot();
        const readConfig = await load();

        await writeConfigFile(root, createConfig('${MAW_CONFIG_HOST}', '${MAW_CONFIG_PATH}'));

        await expect(readConfig(root)).resolves.toMatchObject({
            openviking: { host: '${MAW_CONFIG_HOST}' },
            templates: { customPath: '${MAW_CONFIG_PATH}' },
        });
    });

    it('throws when maw.json is missing required project fields', async () => {
        const root = await createRoot();
        const readConfig = await load();

        await writeConfigFile(root, {
            workspace: '.',
            openviking: { enabled: true, host: 'localhost' },
            templates: {},
        });

        await expect(readConfig(root)).rejects.toThrow('Invalid config: missing openviking.port');
    });

    it('passes through plain strings, booleans, and numbers unchanged', async () => {
        const root = await createRoot();
        const readConfig = await load();

        await writeConfigFile(root, createConfig('127.0.0.1', 'custom/templates'));

        await expect(readConfig(root)).resolves.toMatchObject({
            workspace: '.',
            openviking: { enabled: true, host: '127.0.0.1', port: 1933 },
            templates: { customPath: 'custom/templates' },
        });
    });
});
