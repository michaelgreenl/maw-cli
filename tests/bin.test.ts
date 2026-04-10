import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(testDir, "..");

describe("installed bin wrapper", () => {
  it("runs the placeholder init command", () => {
    const res = spawnSync(
      process.execPath,
      [resolve(root, "bin/maw.js"), "init"],
      {
        encoding: "utf8",
      },
    );

    expect(res.status).toBe(1);
    expect(res.stderr).toContain("maw init is not implemented yet.");
  });
});
