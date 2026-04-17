export const printError = (err) => {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
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
