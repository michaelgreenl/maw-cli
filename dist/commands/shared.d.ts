export interface CommandDefinition<Name extends string = string> {
    name: Name;
    summary: string;
    usage?: string;
    run: (args: readonly string[]) => Promise<number>;
}
export declare const printError: (err: unknown) => number;
export declare const createPlaceholderCommand: <Name extends string>(name: Name, summary: string) => CommandDefinition<Name>;
