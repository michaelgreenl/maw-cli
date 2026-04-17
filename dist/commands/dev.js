import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { ensureConfig } from '../utils/config.js';
import { ensureWorkflowFiles, spawnLanggraph } from '../utils/langgraph.js';
import { printError } from './shared.js';
const usage = 'dev <workflow> [langgraph args...]';
const parse = (args) => {
    const workflow = args[0];
    if (!workflow || workflow.startsWith('-')) {
        throw new Error(`Workflow name is required.\nUsage: maw-cli ${usage}`);
    }
    return { workflow, rest: args.slice(1) };
};
const workflowDir = (root, workflow) => {
    return join(root, '.maw/graphs', workflow);
};
const ensureDir = async (dir) => {
    try {
        const entry = await stat(dir);
        if (entry.isDirectory()) {
            return;
        }
    }
    catch {
        // Fall through to the shared error below.
    }
    throw new Error(`Workflow directory not found: ${dir}`);
};
export const runDev = async (args, root = process.cwd(), launch = spawnLanggraph) => {
    try {
        const parsed = parse(args);
        const dir = workflowDir(root, parsed.workflow);
        await ensureConfig(root);
        await ensureDir(dir);
        await ensureWorkflowFiles(dir);
        return await launch('dev', ['--config', `.maw/graphs/${parsed.workflow}`, ...parsed.rest]);
    }
    catch (err) {
        return printError(err);
    }
};
export const devCommand = {
    name: 'dev',
    summary: 'Start LangGraph dev server for one workflow',
    usage,
    run: runDev,
};
