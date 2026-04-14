import { type LanggraphSub, spawnLanggraph } from '../utils/langgraph.js';
export interface CommandDefinition<Name extends string = string> {
    name: Name;
    summary: string;
    run: (args: readonly string[]) => Promise<number>;
}
export declare const runLanggraph: (sub: LanggraphSub, args: readonly string[], root?: string, launch?: typeof spawnLanggraph) => Promise<number>;
export declare const createPlaceholderCommand: <Name extends string>(name: Name, summary: string) => CommandDefinition<Name>;
