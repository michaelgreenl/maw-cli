import { spawnLanggraph } from '../utils/langgraph.js';
import { type CommandDefinition } from './shared.js';
export declare const runDev: (args: readonly string[], root?: string, launch?: typeof spawnLanggraph) => Promise<number>;
export declare const devCommand: CommandDefinition<'dev'>;
