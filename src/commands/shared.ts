export interface CommandDefinition<Name extends string = string> {
  name: Name;
  summary: string;
  run: (args: readonly string[]) => Promise<number>;
}

export const createPlaceholderCommand = <Name extends string>(
  name: Name,
  summary: string,
): CommandDefinition<Name> => ({
  name,
  summary,
  run: async () => {
    process.stderr.write(`maw ${name} is not implemented yet.\n`);
    return 1;
  },
});
