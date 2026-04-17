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
const WORKFLOW_FILES = ['graph.ts', 'config.json', FILE];
const req = createRequire(import.meta.url);
const exists = async (file) => {
    try {
        await access(file);
        return true;
    }
    catch {
        return false;
    }
};
const createLanggraphJson = (name, graph, env, dependencies) => {
    const cfg = {
        node_version: NODE,
        graphs: { [name]: graph },
        env,
    };
    if (dependencies) {
        cfg.dependencies = [...dependencies];
    }
    return cfg;
};
export const createWorkflowLanggraphJson = (name) => {
    return createLanggraphJson(name, WORKFLOW_GRAPH, WORKFLOW_ENV);
};
export const ensureWorkflowFiles = async (dir) => {
    for (const name of WORKFLOW_FILES) {
        const file = join(dir, name);
        if (!(await exists(file))) {
            throw new Error(`Workflow file not found: ${file}`);
        }
    }
};
const resolveBin = async () => {
    const file = req.resolve(`${PKG}/package.json`);
    const manifest = JSON.parse(await readFile(file, 'utf8'));
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
export const spawnLanggraph = async (sub, args) => {
    const file = await resolveBin();
    return await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [file, sub, ...args], {
            stdio: 'inherit',
        });
        child.once('error', reject);
        child.once('exit', (code) => {
            resolve(code ?? 1);
        });
    });
};
