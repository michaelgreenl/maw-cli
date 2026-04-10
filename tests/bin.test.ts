import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(testDir, "..");

describe("installed bin wrapper", () => {
  it("prints help through the built entrypoint", () => {
    const res = spawnSync(
      process.execPath,
      [resolve(root, "bin/maw.js"), "--help"],
      {
        encoding: "utf8",
      },
    );

    expect(res.status).toBe(0);
    expect(res.stdout).toContain("Usage: maw <command>");
  });
});
