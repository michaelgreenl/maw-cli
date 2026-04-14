import { type CommandDefinition, runLanggraph } from './shared.js';
import { spawnLanggraph } from '../utils/langgraph.js';

export const runStart = async (
    args: readonly string[],
    root = process.cwd(),
    launch: typeof spawnLanggraph = spawnLanggraph,
): Promise<number> => {
    return runLanggraph('start', args, root, launch);
};

export const startCommand: CommandDefinition<'start'> = {
    name: 'start',
    summary: 'Start LangGraph production server',
    run: runStart,
};
