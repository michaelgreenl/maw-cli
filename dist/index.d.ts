#!/usr/bin/env node
import { type CommandDefinition } from './commands/shared.js';
export { readConfig, type MawProjectConfig } from './utils/config.js';
declare const commandDefinitions: readonly [CommandDefinition<"init">, CommandDefinition<"dev">, CommandDefinition<"start">, CommandDefinition<"ov:init">, CommandDefinition<"ov:index">];
export declare const COMMAND_NAMES: ("dev" | "start" | "init" | "ov:index" | "ov:init")[];
export type CommandName = (typeof commandDefinitions)[number]['name'];
export declare const parseCommandName: (argv: readonly string[]) => CommandName | undefined;
export declare const formatHelp: () => string;
export declare const runCli: (argv?: readonly string[]) => Promise<number>;
