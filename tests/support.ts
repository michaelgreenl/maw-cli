import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { vi } from 'vitest';

const roots: string[] = [];

export const createRoot = async (prefix: string): Promise<string> => {
    const root = await mkdtemp(join(tmpdir(), prefix));
    roots.push(root);
    return root;
};

export const cleanupRoots = async (): Promise<void> => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
};

export const writeConfig = async (root: string, apiKey = '${OPENAI_API_KEY}'): Promise<void> => {
    await mkdir(join(root, '.maw'), { recursive: true });
    await writeFile(
        join(root, '.maw', 'config.json'),
        JSON.stringify(
            {
                workspace: '.',
                graph: { name: 'agent' },
                openviking: { enabled: true, host: 'localhost', port: 1933 },
                llm: { provider: 'openai', apiKey },
                templates: {
                    sources: ['embedded', 'custom'],
                    customPath: '.maw/templates',
                    gitRepos: [],
                    globalSnippets: ['general-coding', 'security', 'project-context'],
                    agents: {
                        researcher: { snippets: ['research-rules', 'python'] },
                    },
                },
            },
            null,
            2,
        ),
    );
};

export const captureStderr = (): { output: string[]; restore: () => void } => {
    const output: string[] = [];
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: string | Uint8Array) => {
        output.push(String(chunk));
        return true;
    }) as typeof process.stderr.write);

    return {
        output,
        restore: () => {
            spy.mockRestore();
        },
    };
};
