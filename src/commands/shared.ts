import { ensureConfig } from '../utils/config.js';
import { type LanggraphSub, ensureLanggraphJson, spawnLanggraph } from '../utils/langgraph.js';

export interface CommandDefinition<Name extends string = string> {
    name: Name;
    summary: string;
    run: (args: readonly string[]) => Promise<number>;
}

const toMessage = (err: unknown): string => {
    return err instanceof Error ? err.message : String(err);
};

export const runLanggraph = async (
    sub: LanggraphSub,
    args: readonly string[],
    root = process.cwd(),
    launch: typeof spawnLanggraph = spawnLanggraph,
): Promise<number> => {
    try {
        await ensureConfig(root);
        await ensureLanggraphJson(root);
        return await launch(sub, args);
    } catch (err) {
        process.stderr.write(`${toMessage(err)}\n`);
        return 1;
    }
};

export const createPlaceholderCommand = <Name extends string>(
    name: Name,
    summary: string,
): CommandDefinition<Name> => ({
    name,
    summary,
    run: async () => {
        process.stderr.write(`maw-cli ${name} is not implemented yet.\n`);
        return 1;
    },
});
