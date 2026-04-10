import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
const exists = async (file) => {
    try {
        await access(file);
        return true;
    }
    catch {
        return false;
    }
};
const readPackage = async (root) => {
    const file = join(root, "package.json");
    const text = await readFile(file, "utf8");
    return JSON.parse(text);
};
const candidateNames = (pkg) => {
    const names = new Set();
    for (const deps of [
        pkg.dependencies ?? {},
        pkg.devDependencies ?? {},
        pkg.optionalDependencies ?? {},
    ]) {
        for (const name of Object.keys(deps)) {
            if (name !== "maw") {
                names.add(name);
            }
        }
    }
    return [...names];
};
const loadWorkflow = async (root) => {
    const pkg = await readPackage(root);
    const require = createRequire(join(root, "package.json"));
    const matches = [];
    for (const name of candidateNames(pkg)) {
        try {
            const manifest = require.resolve(`${name}/package.json`);
            const dir = dirname(manifest);
            const meta = JSON.parse(await readFile(manifest, "utf8"));
            const entry = meta.exports?.["./scaffold"];
            const next = typeof entry === "string"
                ? entry
                : entry && typeof entry === "object"
                    ? typeof entry.import === "string"
                        ? entry.import
                        : typeof entry.default === "string"
                            ? entry.default
                            : typeof entry.require === "string"
                                ? entry.require
                                : undefined
                    : undefined;
            if (!next) {
                continue;
            }
            const file = join(dir, next);
            const mod = (await import(pathToFileURL(file).href));
            if (mod.scaffold && typeof mod.createScaffoldFiles === "function") {
                matches.push(mod);
            }
        }
        catch {
            // Ignore packages that are not workflow packages.
        }
    }
    if (matches.length === 1) {
        return matches[0];
    }
    if (matches.length === 0) {
        throw new Error("No installed workflow package exposes the MAW scaffold contract.");
    }
    throw new Error("Multiple installed workflow packages expose the MAW scaffold contract.");
};
const mergeGitignore = async (root, entries) => {
    const file = join(root, ".gitignore");
    const text = (await exists(file)) ? await readFile(file, "utf8") : "";
    const lines = text.split("\n").filter((line) => line.length > 0);
    for (const entry of entries) {
        if (!lines.includes(entry)) {
            lines.push(entry);
        }
    }
    await writeFile(file, `${lines.join("\n")}\n`);
};
const writeMissing = async (root, files) => {
    for (const [rel, content] of Object.entries(files)) {
        const file = join(root, rel);
        if (await exists(file)) {
            continue;
        }
        await mkdir(dirname(file), { recursive: true });
        await writeFile(file, content);
    }
};
export const runInit = async (_args, root = process.cwd()) => {
    try {
        const mod = await loadWorkflow(root);
        for (const dir of mod.scaffold.directories) {
            await mkdir(join(root, dir), { recursive: true });
        }
        await writeMissing(root, await mod.createScaffoldFiles(mod.scaffold.packageName));
        await mergeGitignore(root, mod.scaffold.gitignore);
        process.stdout.write(`Initialized .maw scaffold using ${mod.scaffold.packageName}.\n`);
        return 0;
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(`${message}\n`);
        return 1;
    }
};
export const initCommand = {
    name: "init",
    summary: "Scaffold .maw/ config in target project",
    run: (args) => runInit(args),
};
