import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { ensureConfig } from '../utils/config.js';
import { ensureWorkflowFiles, spawnLanggraph } from '../utils/langgraph.js';
import { printError } from './shared.js';
const usage = 'dev <workflow> [langgraph args...]';
export const runDev = async (args, root = process.cwd(), launch = spawnLanggraph) => {
    try {
        const workflow = args[0];
        if (!workflow || workflow.startsWith('-')) {
            throw new Error(`Workflow name is required.\nUsage: maw-cli ${usage}`);
        }
        const dir = join(root, '.maw/graphs', workflow);
        await ensureConfig(root);
        try {
            const entry = await stat(dir);
            if (!entry.isDirectory()) {
                throw new Error(`Workflow directory not found: ${dir}`);
            }
        }
        catch {
            throw new Error(`Workflow directory not found: ${dir}`);
        }
        await ensureWorkflowFiles(dir);
        return await launch('dev', ['--config', `.maw/graphs/${workflow}`, ...args.slice(1)]);
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
