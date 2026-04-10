#!/usr/bin/env node

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const entry = [
  resolve(dir, "../dist/index.js"),
  resolve(dir, "../maw/dist/index.js"),
].find(existsSync);

if (!entry) {
  process.stderr.write("Unable to locate maw entrypoint.\n");
  process.exit(1);
}

const { runCli } = await import(pathToFileURL(entry).href);

void runCli(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (err) => {
    const message =
      err instanceof Error ? (err.stack ?? err.message) : String(err);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  },
);
