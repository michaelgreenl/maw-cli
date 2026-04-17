#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { devCommand } from './commands/dev.js';
import { initCommand } from './commands/init.js';
import { ovIndexCommand } from './commands/ov-index.js';
import { ovInitCommand } from './commands/ov-init.js';
export { readConfig } from './utils/config.js';
const commandDefinitions = [initCommand, devCommand, ovInitCommand, ovIndexCommand];
export const COMMAND_NAMES = commandDefinitions.map((command) => command.name);
const commandMap = new Map(commandDefinitions.map((command) => [command.name, command]));
const HELP_FLAGS = new Set(['-h', '--help', 'help']);
export const parseCommandName = (argv) => {
    const candidate = argv[0];
    if (!candidate || HELP_FLAGS.has(candidate)) {
        return undefined;
    }
    return commandMap.get(candidate)?.name;
};
export const formatHelp = () => [
    'Usage: maw-cli <command>',
    '',
    'Commands:',
    ...commandDefinitions.map((command) => `  maw-cli ${command.usage ?? command.name}  ${command.summary}`),
].join('\n');
export const runCli = async (argv = process.argv.slice(2)) => {
    if (argv.length === 0 || HELP_FLAGS.has(argv[0])) {
        process.stdout.write(`${formatHelp()}\n`);
        return 0;
    }
    const commandName = parseCommandName(argv);
    if (!commandName) {
        process.stderr.write(`Unknown command: ${argv[0]}\n\n${formatHelp()}\n`);
        return 1;
    }
    const command = commandMap.get(commandName);
    if (!command) {
        process.stderr.write(`Unknown command: ${commandName}\n\n${formatHelp()}\n`);
        return 1;
    }
    return command.run(argv.slice(1));
};
const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) {
    void runCli().then((exitCode) => {
        process.exitCode = exitCode;
    }, (error) => {
        const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
        process.stderr.write(`${message}\n`);
        process.exitCode = 1;
    });
}
