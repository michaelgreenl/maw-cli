import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createWorkflowLanggraphJson } from '../utils/langgraph.js';
const PACKAGE_JSON = 'package.json';
const SCAFFOLD_EXPORT = './scaffold';
const IGNORED_PACKAGE = 'maw-cli';
const GITIGNORE_ENTRY = '.maw/openviking/';
const GRAPH_ROOT = '.maw/graphs';
const PROJECT_DIRS = ['.maw/templates', '.maw/graphs'];
const OV_PORT = 1933;
const EMBEDDING_DIMENSION = 3072;
const EMBEDDING_CONCURRENCY = 10;
const VLM_CONCURRENCY = 100;
const PROJECT_CFG = {
    workspace: '.',
    openviking: {
        enabled: true,
        host: 'localhost',
        port: OV_PORT,
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
            dimension: EMBEDDING_DIMENSION,
            model: 'text-embedding-3-large',
        },
        max_concurrent: EMBEDDING_CONCURRENCY,
    },
    vlm: {
        api_base: 'https://api.openai.com/v1',
        api_key: '${OPENAI_API_KEY}',
        provider: 'openai',
        model: 'gpt-4o',
        max_concurrent: VLM_CONCURRENCY,
    },
};
const dependencyFields = ['dependencies', 'devDependencies', 'optionalDependencies'];
const formatJson = (value) => `${JSON.stringify(value, null, 4)}\n`;
const isRecord = (value) => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};
const parsePackageJson = (value) => {
    if (!isRecord(value)) {
        throw new Error(`Invalid ${PACKAGE_JSON}.`);
    }
    return value;
};
const parseWorkflowFiles = (value, pkg) => {
    if (!isRecord(value) || typeof value['graph.ts'] !== 'string' || typeof value['config.json'] !== 'string') {
        throw new Error(`Invalid scaffold files from ${pkg}.`);
    }
    return {
        'graph.ts': value['graph.ts'],
        'config.json': value['config.json'],
    };
};
const getInstalledDependencyNames = (pkg) => {
    const names = new Set();
    for (const field of dependencyFields) {
        const deps = pkg[field];
        if (!isRecord(deps)) {
            continue;
        }
        for (const name of Object.keys(deps)) {
            if (name !== IGNORED_PACKAGE) {
                names.add(name);
            }
        }
    }
    return [...names];
};
const resolveScaffoldExport = (exportsField) => {
    if (!isRecord(exportsField)) {
        return undefined;
    }
    const entry = exportsField[SCAFFOLD_EXPORT];
    if (typeof entry === 'string') {
        return entry;
    }
    if (!isRecord(entry)) {
        return undefined;
    }
    if (typeof entry.import === 'string') {
        return entry.import;
    }
    if (typeof entry.default === 'string') {
        return entry.default;
    }
    if (typeof entry.require === 'string') {
        return entry.require;
    }
    return undefined;
};
const tryLoadWorkflowModule = async (requireFromRoot, packageName) => {
    try {
        const manifestPath = requireFromRoot.resolve(`${packageName}/${PACKAGE_JSON}`);
        const packageDir = dirname(manifestPath);
        const manifest = parsePackageJson(JSON.parse(await readFile(manifestPath, 'utf8')));
        const scaffoldExport = resolveScaffoldExport(manifest.exports);
        if (!scaffoldExport) {
            return null;
        }
        const modulePath = join(packageDir, scaffoldExport);
        const loaded = await import(pathToFileURL(modulePath).href);
        if (!isRecord(loaded) || !isRecord(loaded.scaffold)) {
            return null;
        }
        if (typeof loaded.scaffold.packageName !== 'string' ||
            typeof loaded.scaffold.workflow !== 'string' ||
            typeof loaded.createScaffoldFiles !== 'function') {
            return null;
        }
        const create = loaded.createScaffoldFiles;
        const pkg = loaded.scaffold.packageName;
        const workflow = loaded.scaffold.workflow;
        return {
            scaffold: {
                packageName: pkg,
                workflow,
            },
            createScaffoldFiles: async () => {
                return parseWorkflowFiles(await create(), pkg);
            },
        };
    }
    catch {
        return null;
    }
};
export const loadWorkflows = async (root) => {
    const pkg = parsePackageJson(JSON.parse(await readFile(join(root, PACKAGE_JSON), 'utf8')));
    const requireFromRoot = createRequire(join(root, PACKAGE_JSON));
    const dependencyNames = getInstalledDependencyNames(pkg);
    const matches = await Promise.all(dependencyNames.map((name) => tryLoadWorkflowModule(requireFromRoot, name)));
    const mods = matches
        .filter((mod) => mod !== null)
        .sort((left, right) => {
        const byWorkflow = left.scaffold.workflow.localeCompare(right.scaffold.workflow);
        if (byWorkflow !== 0) {
            return byWorkflow;
        }
        return left.scaffold.packageName.localeCompare(right.scaffold.packageName);
    });
    const seen = new Set();
    for (const mod of mods) {
        const name = mod.scaffold.workflow;
        if (seen.has(name)) {
            throw new Error(`Duplicate workflow name: ${name}`);
        }
        seen.add(name);
    }
    return mods;
};
const mergeGitignore = async (root, entries) => {
    const gitignorePath = join(root, '.gitignore');
    const existing = await readFile(gitignorePath, 'utf8').catch(() => '');
    const lines = new Set(existing.split('\n').filter(Boolean));
    for (const entry of entries) {
        lines.add(entry);
    }
    await writeFile(gitignorePath, `${[...lines].join('\n')}\n`);
};
const writeMissingFiles = async (root, files) => {
    for (const [relativePath, content] of Object.entries(files)) {
        const filePath = join(root, relativePath);
        try {
            await access(filePath);
            continue;
        }
        catch {
            await mkdir(dirname(filePath), { recursive: true });
            await writeFile(filePath, content);
        }
    }
};
const writeWorkflows = async (root, mods) => {
    for (const mod of mods) {
        const name = mod.scaffold.workflow;
        const dir = join(GRAPH_ROOT, name);
        const files = await mod.createScaffoldFiles();
        await mkdir(join(root, GRAPH_ROOT, name), { recursive: true });
        await writeMissingFiles(root, {
            [join(dir, 'graph.ts')]: files['graph.ts'],
            [join(dir, 'config.json')]: files['config.json'],
            [join(dir, 'langgraph.json')]: formatJson(createWorkflowLanggraphJson(name)),
        });
    }
};
export const runInit = async (_args, root = process.cwd()) => {
    try {
        const mods = await loadWorkflows(root);
        for (const dir of PROJECT_DIRS) {
            await mkdir(join(root, dir), { recursive: true });
        }
        await writeMissingFiles(root, {
            'maw.json': formatJson(PROJECT_CFG),
            '.maw/ov.conf': formatJson(OV_CFG),
        });
        await mergeGitignore(root, [GITIGNORE_ENTRY]);
        if (mods.length === 0) {
            process.stderr.write('Warning: initialized project MAW scaffold without workflows. Install a workflow package and rerun `maw-cli init`.\n');
            return 0;
        }
        await writeWorkflows(root, mods);
        process.stdout.write(`Initialized project MAW scaffold for workflows: ${mods.map((mod) => mod.scaffold.workflow).join(', ')}.\n`);
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
