#!/usr/bin/env node

import { pathToFileURL } from "node:url";
import { devCommand } from "./commands/dev.js";
import { initCommand } from "./commands/init.js";
import { ovIndexCommand } from "./commands/ov-index.js";
import { ovInitCommand } from "./commands/ov-init.js";
import { startCommand } from "./commands/start.js";
import { type CommandDefinition } from "./commands/shared.js";

const commandDefinitions = [
  initCommand,
  devCommand,
  startCommand,
  ovInitCommand,
  ovIndexCommand,
] as const;

export const COMMAND_NAMES = commandDefinitions.map((command) => command.name);

export type CommandName = (typeof commandDefinitions)[number]["name"];

const commandMap = new Map<CommandName, CommandDefinition<CommandName>>(
  commandDefinitions.map((command) => [command.name, command]),
);

const HELP_FLAGS = new Set(["-h", "--help", "help"]);

export const parseCommandName = (
  argv: readonly string[],
): CommandName | undefined => {
  const candidate = argv[0];

  if (!candidate || HELP_FLAGS.has(candidate)) {
    return undefined;
  }

  return commandMap.has(candidate as CommandName)
    ? (candidate as CommandName)
    : undefined;
};

export const formatHelp = (): string =>
  [
    "Usage: maw <command>",
    "",
    "Commands:",
    ...commandDefinitions.map(
      (command) => `  maw ${command.name}  ${command.summary}`,
    ),
  ].join("\n");

export const runCli = async (
  argv: readonly string[] = process.argv.slice(2),
): Promise<number> => {
  if (argv.length === 0 || HELP_FLAGS.has(argv[0])) {
    process.stdout.write(`${formatHelp()}\n`);
    return 0;
  }

  const commandName = parseCommandName(argv);

  if (!commandName) {
    process.stderr.write(`Unknown command: ${argv[0]}\n\n${formatHelp()}\n`);
    return 1;
  }

  return commandMap.get(commandName)!.run(argv.slice(1));
};

const isExecutedDirectly = (): boolean => {
  const entryPoint = process.argv[1];

  if (!entryPoint) {
    return false;
  }

  return import.meta.url === pathToFileURL(entryPoint).href;
};

if (isExecutedDirectly()) {
  void runCli().then(
    (exitCode) => {
      process.exitCode = exitCode;
    },
    (error: unknown) => {
      const message =
        error instanceof Error ? (error.stack ?? error.message) : String(error);
      process.stderr.write(`${message}\n`);
      process.exitCode = 1;
    },
  );
}
