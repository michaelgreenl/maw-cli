import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
const PACKAGE_JSON = 'package.json';
const SCAFFOLD_EXPORT = './scaffold';
const IGNORED_PACKAGE = 'maw-cli';
const GITIGNORE_ENTRY = '.maw/openviking/';
const PROJECT_DIRS = ['.maw/templates', '.maw/graphs'];
const PROJECT_CFG = {
    workspace: '.',
    openviking: {
        enabled: true,
        host: 'localhost',
        port: 1933,
    },
    templates: {
        customPath: '.maw/templates',
    },
};
const OV_CFG = {
    storage: {
        workspace: './.maw/openviking',
    },
    log: {
        level: 'INFO',
        output: 'stdout',
    },
    embedding: {
        dense: {
            api_base: 'https://api.openai.com/v1',
            api_key: '${OPENAI_API_KEY}',
            provider: 'openai',
            dimension: 3072,
            model: 'text-embedding-3-large',
        },
        max_concurrent: 10,
    },
    vlm: {
        api_base: 'https://api.openai.com/v1',
        api_key: '${OPENAI_API_KEY}',
        provider: 'openai',
        model: 'gpt-4o',
        max_concurrent: 100,
    },
};
const dependencyFields = ['dependencies', 'devDependencies', 'optionalDependencies'];
const formatJson = (value) => `${JSON.stringify(value, null, 4)}\n`;
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
const isRecord = (value) => {
    return typeof value === 'object' && value !== null;
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
const isWorkflowModule = (value) => typeof value.scaffold?.packageName === 'string' &&
    typeof value.scaffold?.workflow === 'string' &&
    typeof value.createScaffoldFiles === 'function';
const isWorkflowFiles = (value) => {
    if (!isRecord(value)) {
        return false;
    }
    return typeof value['graph.ts'] === 'string' && typeof value['config.json'] === 'string';
};
const createProjectFiles = () => ({
    'maw.json': formatJson(PROJECT_CFG),
    '.maw/ov.conf': formatJson(OV_CFG),
});
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
const sortWorkflows = (mods) => {
    return mods.sort((left, right) => {
        const byWorkflow = left.scaffold.workflow.localeCompare(right.scaffold.workflow);
        if (byWorkflow !== 0) {
            return byWorkflow;
        }
        return left.scaffold.packageName.localeCompare(right.scaffold.packageName);
    });
};
const findDuplicateWorkflow = (mods) => {
    const seen = new Set();
    for (const mod of mods) {
        const name = mod.scaffold.workflow;
        if (seen.has(name)) {
            return name;
        }
        seen.add(name);
    }
    return null;
};
export const loadWorkflows = async (root) => {
    const pkg = await readPackageJson(root);
    const requireFromRoot = createRequire(join(root, PACKAGE_JSON));
    const dependencyNames = getInstalledDependencyNames(pkg);
    const matches = await Promise.all(dependencyNames.map((name) => tryLoadWorkflowModule(requireFromRoot, name)));
    const mods = sortWorkflows(matches.filter((mod) => mod !== null));
    const duplicate = findDuplicateWorkflow(mods);
    if (duplicate) {
        throw new Error(`Duplicate workflow name: ${duplicate}`);
    }
    return mods;
};
const pickWorkflow = (mods) => {
    if (mods.length === 1) {
        return mods[0];
    }
    if (mods.length === 0) {
        throw new Error('No installed workflow package exposes the MAW scaffold contract.');
    }
    throw new Error('Multiple installed workflow packages expose the MAW scaffold contract.');
};
const readWorkflowFiles = async (workflow) => {
    const files = await workflow.createScaffoldFiles();
    if (isWorkflowFiles(files)) {
        return files;
    }
    throw new Error(`Invalid scaffold files from ${workflow.scaffold.packageName}.`);
};
const toLegacyFiles = (files) => ({
    '.maw/config.json': files['config.json'],
    '.maw/graph.ts': files['graph.ts'],
});
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
        const workflow = pickWorkflow(await loadWorkflows(root));
        for (const dir of PROJECT_DIRS) {
            await mkdir(join(root, dir), { recursive: true });
        }
        await writeMissingFiles(root, createProjectFiles());
        const scaffoldFiles = toLegacyFiles(await readWorkflowFiles(workflow));
        await writeMissingFiles(root, scaffoldFiles);
        await mergeGitignore(root, [GITIGNORE_ENTRY]);
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
