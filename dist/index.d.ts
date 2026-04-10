#!/usr/bin/env node
import { type CommandDefinition } from './commands/shared.js';
declare const commandDefinitions: readonly [CommandDefinition<"init">, CommandDefinition<"dev">, CommandDefinition<"start">, CommandDefinition<"ov:init">, CommandDefinition<"ov:index">];
export declare const COMMAND_NAMES: ("dev" | "init" | "ov:index" | "ov:init" | "start")[];
export type CommandName = (typeof commandDefinitions)[number]['name'];
export declare const parseCommandName: (argv: readonly string[]) => CommandName | undefined;
export declare const formatHelp: () => string;
export declare const runCli: (argv?: readonly string[]) => Promise<number>;
export {};
