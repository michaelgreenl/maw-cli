export interface CommandDefinition<Name extends string = string> {
    name: Name;
    summary: string;
    usage?: string;
    run: (args: readonly string[]) => Promise<number>;
}

const toMessage = (err: unknown): string => {
    return err instanceof Error ? err.message : String(err);
};

export const printError = (err: unknown): number => {
    process.stderr.write(`${toMessage(err)}\n`);
    return 1;
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
