import { runLanggraph } from './shared.js';
import { spawnLanggraph } from '../utils/langgraph.js';
export const runDev = async (args, root = process.cwd(), launch = spawnLanggraph) => {
    return runLanggraph('dev', args, root, launch);
};
export const devCommand = {
    name: 'dev',
    summary: 'Start LangGraph dev server',
    run: runDev,
};
