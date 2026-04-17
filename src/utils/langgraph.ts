import { spawn } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const FILE = 'langgraph.json';
const PKG = '@langchain/langgraph-cli';
const BIN = 'langgraphjs';
const NODE = '20';
const WORKFLOW_ENV = '../../../.env';
const WORKFLOW_GRAPH = './graph.ts:graph';
const WORKFLOW_FILES = ['graph.ts', 'config.json', FILE] as const;
const req = createRequire(import.meta.url);

export interface LanggraphConfig {
    node_version: string;
    graphs: Record<string, string>;
    env: string;
    dependencies?: readonly string[];
}

export const createWorkflowLanggraphJson = (name: string): LanggraphConfig => {
    return {
        node_version: NODE,
        graphs: { [name]: WORKFLOW_GRAPH },
        env: WORKFLOW_ENV,
    };
};

export const ensureWorkflowFiles = async (dir: string): Promise<void> => {
    for (const name of WORKFLOW_FILES) {
        const file = join(dir, name);

        try {
            await access(file);
        } catch {
            throw new Error(`Workflow file not found: ${file}`);
        }
    }
};

const resolveBin = async (): Promise<string> => {
    const file = req.resolve(`${PKG}/package.json`);
    const manifest: unknown = JSON.parse(await readFile(file, 'utf8'));
    const dir = dirname(file);
    const binField = typeof manifest === 'object' && manifest !== null && 'bin' in manifest ? manifest.bin : undefined;

    if (typeof binField === 'string') {
        return join(dir, binField);
    }

    if (typeof binField === 'object' && binField !== null) {
        for (const [name, value] of Object.entries(binField)) {
            if (name === BIN && typeof value === 'string') {
                return join(dir, value);
            }
        }

        const bin = Object.values(binField).find((value): value is string => typeof value === 'string');

        if (bin) {
            return join(dir, bin);
        }
    }

    throw new Error(`Unable to resolve ${BIN} from ${PKG}.`);
};

export const spawnLanggraph = async (sub: 'dev', args: readonly string[]): Promise<number> => {
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
