import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
const PACKAGE_JSON = 'package.json';
const SCAFFOLD_EXPORT = './scaffold';
const IGNORED_PACKAGE = 'maw-cli';
const dependencyFields = ['dependencies', 'devDependencies', 'optionalDependencies'];
const fileExists = async (filePath) => {
    try {
        await access(filePath);
        return true;
    }
    catch {
        return false;
    }
};
const readJson = async (filePath) => {
    const content = await readFile(filePath, 'utf8');
    return JSON.parse(content);
};
const readPackageJson = (root) => {
    return readJson(join(root, PACKAGE_JSON));
};
const getInstalledDependencyNames = (pkg) => {
    const names = new Set();
    for (const field of dependencyFields) {
        const deps = pkg[field] ?? {};
        for (const name of Object.keys(deps)) {
            if (name !== IGNORED_PACKAGE) {
                names.add(name);
            }
        }
    }
    return [...names];
};
const resolveScaffoldExport = (exportsField) => {
    const entry = exportsField?.[SCAFFOLD_EXPORT];
    if (typeof entry === 'string') {
        return entry;
    }
    if (!entry || typeof entry !== 'object') {
        return undefined;
    }
    const conditions = entry;
    if (typeof conditions.import === 'string') {
        return conditions.import;
    }
    if (typeof conditions.default === 'string') {
        return conditions.default;
    }
    if (typeof conditions.require === 'string') {
        return conditions.require;
    }
    return undefined;
};
const isWorkflowModule = (value) => Boolean(value.scaffold) && typeof value.createScaffoldFiles === 'function';
const tryLoadWorkflowModule = async (requireFromRoot, packageName) => {
    try {
        const manifestPath = requireFromRoot.resolve(`${packageName}/${PACKAGE_JSON}`);
        const packageDir = dirname(manifestPath);
        const manifest = await readJson(manifestPath);
        const scaffoldExport = resolveScaffoldExport(manifest.exports);
        if (!scaffoldExport) {
            return null;
        }
        const modulePath = join(packageDir, scaffoldExport);
        const loaded = (await import(pathToFileURL(modulePath).href));
        return isWorkflowModule(loaded) ? loaded : null;
    }
    catch {
        return null;
    }
};
const loadWorkflow = async (root) => {
    const pkg = await readPackageJson(root);
    const requireFromRoot = createRequire(join(root, PACKAGE_JSON));
    const dependencyNames = getInstalledDependencyNames(pkg);
    const matches = (await Promise.all(dependencyNames.map((name) => tryLoadWorkflowModule(requireFromRoot, name)))).filter((mod) => mod !== null);
    if (matches.length === 1) {
        return matches[0];
    }
    if (matches.length === 0) {
        throw new Error('No installed workflow package exposes the MAW scaffold contract.');
    }
    throw new Error('Multiple installed workflow packages expose the MAW scaffold contract.');
};
const mergeGitignore = async (root, entries) => {
    const gitignorePath = join(root, '.gitignore');
    const existing = (await fileExists(gitignorePath)) ? await readFile(gitignorePath, 'utf8') : '';
    const lines = new Set(existing.split('\n').filter(Boolean));
    for (const entry of entries) {
        lines.add(entry);
    }
    await writeFile(gitignorePath, `${[...lines].join('\n')}\n`);
};
const writeMissingFiles = async (root, files) => {
    for (const [relativePath, content] of Object.entries(files)) {
        const filePath = join(root, relativePath);
        if (await fileExists(filePath)) {
            continue;
        }
        await mkdir(dirname(filePath), { recursive: true });
        await writeFile(filePath, content);
    }
};
export const runInit = async (_args, root = process.cwd()) => {
    try {
        const workflow = await loadWorkflow(root);
        for (const directory of workflow.scaffold.directories) {
            await mkdir(join(root, directory), { recursive: true });
        }
        const scaffoldFiles = await workflow.createScaffoldFiles(workflow.scaffold.packageName);
        await writeMissingFiles(root, scaffoldFiles);
        await mergeGitignore(root, workflow.scaffold.gitignore);
        process.stdout.write(`Initialized .maw scaffold using ${workflow.scaffold.packageName}.\n`);
        return 0;
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`${message}\n`);
        return 1;
    }
};
export const initCommand = {
    name: 'init',
    summary: 'Scaffold .maw/ config in target project',
    run: runInit,
};
