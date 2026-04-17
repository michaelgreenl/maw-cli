import { cp, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { vi } from 'vitest';

const roots: string[] = [];
const testDir = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(testDir, 'fixtures', 'workflows');

export type WorkflowFixture = 'docs-agent' | 'code-agent' | 'docs-agent-alt';

export const createRoot = async (prefix: string): Promise<string> => {
    const root = await mkdtemp(join(tmpdir(), prefix));
    roots.push(root);
    return root;
};

export const cleanupRoots = async (): Promise<void> => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
};

export const installWorkflow = async (root: string, fixture: WorkflowFixture): Promise<void> => {
    await mkdir(join(root, 'node_modules'), { recursive: true });
    await cp(join(fixtureDir, fixture), join(root, 'node_modules', fixture), { recursive: true });
};

export const writePackage = async (root: string, deps: readonly WorkflowFixture[] = []): Promise<void> => {
    const entries = Object.fromEntries(deps.map((name) => [name, `file:../${name}`]));
    const pkg =
        deps.length === 0
            ? { name: 'target-project', private: true }
            : { name: 'target-project', private: true, dependencies: entries };

    await writeFile(join(root, 'package.json'), JSON.stringify(pkg));
};

export const createProject = async (prefix: string, deps: readonly WorkflowFixture[] = []): Promise<string> => {
    const root = await createRoot(prefix);

    await writePackage(root, deps);
    await Promise.all(deps.map((fixture) => installWorkflow(root, fixture)));

    return root;
};

export const writeConfig = async (
    root: string,
    cfg: unknown = {
        workspace: '.',
        openviking: { enabled: true, host: 'localhost', port: 1933 },
        templates: {
            customPath: '.maw/templates',
        },
    },
): Promise<void> => {
    await mkdir(root, { recursive: true });
    await writeFile(join(root, 'maw.json'), JSON.stringify(cfg, null, 2));
};

export const captureStderr = (): { output: string[]; restore: () => void } => {
    const output: string[] = [];
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: string | Uint8Array) => {
        output.push(String(chunk));
        return true;
    });

    return {
        output,
        restore: () => {
            spy.mockRestore();
        },
    };
};

export const captureStdout = (): { output: string[]; restore: () => void } => {
    const output: string[] = [];
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
        output.push(String(chunk));
        return true;
    });

    return {
        output,
        restore: () => {
            spy.mockRestore();
        },
    };
};
