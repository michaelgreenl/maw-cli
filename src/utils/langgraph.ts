import { spawn } from 'node:child_process';
import { access, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const FILE = 'langgraph.json';
const PKG = '@langchain/langgraph-cli';
const BIN = 'langgraphjs';
const NODE = '20';
const ROOT_ENV = '.env';
const ROOT_GRAPH = './.maw/graph.ts:graph';
const ROOT_DEPS = ['.'] as const;
const WORKFLOW_ENV = '../../../.env';
const WORKFLOW_GRAPH = './graph.ts:graph';
const WORKFLOW_FILES = ['graph.ts', 'config.json', FILE] as const;
const req = createRequire(import.meta.url);

type Manifest = {
    bin?: string | Record<string, string>;
};

export interface LanggraphConfig {
    node_version: string;
    graphs: Record<string, string>;
    env: string;
    dependencies?: readonly string[];
}

export type LanggraphSub = 'dev' | 'start';

const exists = async (file: string): Promise<boolean> => {
    try {
        await access(file);
        return true;
    } catch {
        return false;
    }
};

const createLanggraphJson = (
    name: string,
    graph: string,
    env: string,
    dependencies?: readonly string[],
): LanggraphConfig => {
    const cfg: LanggraphConfig = {
        node_version: NODE,
        graphs: { [name]: graph },
        env,
    };

    if (dependencies) {
        cfg.dependencies = [...dependencies];
    }

    return cfg;
};

export const createWorkflowLanggraphJson = (name: string): LanggraphConfig => {
    return createLanggraphJson(name, WORKFLOW_GRAPH, WORKFLOW_ENV);
};

const createRootLanggraphJson = (): LanggraphConfig => {
    return createLanggraphJson('agent', ROOT_GRAPH, ROOT_ENV, ROOT_DEPS);
};

export const ensureWorkflowFiles = async (dir: string): Promise<void> => {
    for (const name of WORKFLOW_FILES) {
        const file = join(dir, name);

        if (!(await exists(file))) {
            throw new Error(`Workflow file not found: ${file}`);
        }
    }
};

const resolveBin = async (): Promise<string> => {
    const file = req.resolve(`${PKG}/package.json`);
    const manifest = JSON.parse(await readFile(file, 'utf8')) as Manifest;
    const dir = dirname(file);

    if (typeof manifest.bin === 'string') {
        return join(dir, manifest.bin);
    }

    const bin = manifest.bin?.[BIN] ?? Object.values(manifest.bin ?? {}).find((value) => typeof value === 'string');

    if (bin) {
        return join(dir, bin);
    }

    throw new Error(`Unable to resolve ${BIN} from ${PKG}.`);
};

export const ensureLanggraphJson = async (root: string): Promise<void> => {
    const file = join(root, FILE);

    if (await exists(file)) {
        return;
    }

    await writeFile(file, `${JSON.stringify(createRootLanggraphJson(), null, 4)}\n`);
};

export const spawnLanggraph = async (sub: LanggraphSub, args: readonly string[]): Promise<number> => {
    const file = await resolveBin();

    return await new Promise<number>((resolve, reject) => {
        const child = spawn(process.execPath, [file, sub, ...args], {
            stdio: 'inherit',
        });

        child.once('error', reject);
        child.once('exit', (code) => {
            resolve(code ?? 1);
        });
    });
};
