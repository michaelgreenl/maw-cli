import { type CommandDefinition, runLanggraph } from './shared.js';
import { spawnLanggraph } from '../utils/langgraph.js';

export const runDev = async (
    args: readonly string[],
    root = process.cwd(),
    launch: typeof spawnLanggraph = spawnLanggraph,
): Promise<number> => {
    return runLanggraph('dev', args, root, launch);
};

export const devCommand: CommandDefinition<'dev'> = {
    name: 'dev',
    summary: 'Start LangGraph dev server',
    run: runDev,
};
