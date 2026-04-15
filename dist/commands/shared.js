import { ensureConfig } from '../utils/config.js';
import { ensureLanggraphJson, spawnLanggraph } from '../utils/langgraph.js';
const toMessage = (err) => {
    return err instanceof Error ? err.message : String(err);
};
export const runLanggraph = async (sub, args, root = process.cwd(), launch = spawnLanggraph) => {
    try {
        await ensureConfig(root);
        await ensureLanggraphJson(root);
        return await launch(sub, args);
    }
    catch (err) {
        process.stderr.write(`${toMessage(err)}\n`);
        return 1;
    }
};
export const createPlaceholderCommand = (name, summary) => ({
    name,
    summary,
    run: async () => {
        process.stderr.write(`maw-cli ${name} is not implemented yet.\n`);
        return 1;
    },
});
