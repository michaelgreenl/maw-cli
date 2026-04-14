import { spawn } from 'node:child_process';
import { access, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const FILE = 'langgraph.json';
const PKG = '@langchain/langgraph-cli';
const BIN = 'langgraphjs';
const req = createRequire(import.meta.url);

type Manifest = {
    bin?: string | Record<string, string>;
};

export type LanggraphSub = 'dev' | 'start';

export const LANGGRAPH_JSON = {
    node_version: '20',
    graphs: { agent: './.maw/graph.ts:graph' },
    env: '.env',
    dependencies: ['.'],
} as const;

const exists = async (file: string): Promise<boolean> => {
    try {
        await access(file);
        return true;
    } catch {
        return false;
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

    await writeFile(file, `${JSON.stringify(LANGGRAPH_JSON, null, 4)}\n`);
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
