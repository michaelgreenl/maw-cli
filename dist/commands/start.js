import { runLanggraph } from './shared.js';
import { spawnLanggraph } from '../utils/langgraph.js';
export const runStart = async (args, root = process.cwd(), launch = spawnLanggraph) => {
    return runLanggraph('start', args, root, launch);
};
export const startCommand = {
    name: 'start',
    summary: 'Start LangGraph production server',
    run: runStart,
};
