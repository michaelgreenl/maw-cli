import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const roots: string[] = [];

type Reader = (root: string) => Promise<unknown>;

const load = async (): Promise<Reader> => {
    const mod = (await import('../src/index.js')) as {
        readConfig?: Reader;
    };

    expect(mod.readConfig).toBeTypeOf('function');

    return mod.readConfig as Reader;
};

const createRoot = async (): Promise<string> => {
    const root = await mkdtemp(join(tmpdir(), 'maw-cli-config-'));
    roots.push(root);
    return root;
};

const createConfig = (apiKey: string, host = 'localhost') => ({
    workspace: '.',
    graph: { name: 'agent', agent: 'researcher' },
    openviking: { enabled: true, host, port: 1933 },
    llm: { provider: 'openai', apiKey },
    templates: {
        sources: ['embedded', 'custom'],
        customPath: '.maw/templates',
        gitRepos: [],
        globalSnippets: ['general-coding', 'security', 'project-context'],
        agents: {
            researcher: { snippets: ['research-rules', 'python'] },
            coder: { snippets: ['typescript', 'coding-rules'] },
        },
    },
});

const writeConfigFile = async (root: string, cfg: unknown): Promise<void> => {
    await mkdir(join(root, '.maw'), { recursive: true });
    await writeFile(join(root, '.maw', 'config.json'), JSON.stringify(cfg, null, 2));
};

describe('readConfig', () => {
    afterEach(async () => {
        delete process.env.MAW_CONFIG_KEY;
        delete process.env.MAW_CONFIG_HOST;
        delete process.env.MAW_CONFIG_NESTED;

        await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
    });

    it('reads config from the public api and resolves llm api keys', async () => {
        const root = await createRoot();
        const readConfig = await load();

        process.env.MAW_CONFIG_KEY = 'key-123';
        await writeConfigFile(root, createConfig('${MAW_CONFIG_KEY}'));

        await expect(readConfig(root)).resolves.toMatchObject({
            workspace: '.',
            graph: { name: 'agent', agent: 'researcher' },
            openviking: { enabled: true, host: 'localhost', port: 1933 },
            llm: { provider: 'openai', apiKey: 'key-123' },
        });
    });

    it('throws when .maw/config.json is missing', async () => {
        const root = await createRoot();
        const readConfig = await load();

        await expect(readConfig(root)).rejects.toThrow(`Config file not found: ${join(root, '.maw', 'config.json')}`);
    });

    it('throws when a referenced env var is unset', async () => {
        const root = await createRoot();
        const readConfig = await load();

        await writeConfigFile(root, createConfig('${MAW_CONFIG_KEY}'));

        await expect(readConfig(root)).rejects.toThrow(
            'Environment variable MAW_CONFIG_KEY is not set but referenced in .maw/config.json',
        );
    });

    it('resolves nested interpolation in a single read', async () => {
        const root = await createRoot();
        const readConfig = await load();

        process.env.MAW_CONFIG_KEY = 'nested-key';
        process.env.MAW_CONFIG_HOST = '127.0.0.1';
        await writeConfigFile(root, createConfig('${MAW_CONFIG_KEY}', '${MAW_CONFIG_HOST}'));

        await expect(readConfig(root)).resolves.toMatchObject({
            openviking: { host: '127.0.0.1' },
            llm: { apiKey: 'nested-key' },
        });
    });

    it('passes through plain strings, booleans, and numbers unchanged', async () => {
        const root = await createRoot();
        const readConfig = await load();

        await writeConfigFile(root, createConfig('plain-key'));

        await expect(readConfig(root)).resolves.toMatchObject({
            workspace: '.',
            openviking: { enabled: true, port: 1933 },
            llm: { apiKey: 'plain-key' },
        });
    });
});
