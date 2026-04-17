const toMessage = (err) => {
    return err instanceof Error ? err.message : String(err);
};
export const printError = (err) => {
    process.stderr.write(`${toMessage(err)}\n`);
    return 1;
};
export const createPlaceholderCommand = (name, summary) => ({
    name,
    summary,
    run: async () => {
        process.stderr.write(`maw-cli ${name} is not implemented yet.\n`);
        return 1;
    },
});
