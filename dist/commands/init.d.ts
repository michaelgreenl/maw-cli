import { type CommandDefinition } from './shared.js';
export declare const runInit: (_args: readonly string[], root?: string) => Promise<number>;
export declare const initCommand: CommandDefinition<'init'>;
