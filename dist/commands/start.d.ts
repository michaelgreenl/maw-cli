import { type CommandDefinition } from './shared.js';
import { spawnLanggraph } from '../utils/langgraph.js';
export declare const runStart: (args: readonly string[], root?: string, launch?: typeof spawnLanggraph) => Promise<number>;
export declare const startCommand: CommandDefinition<'start'>;
