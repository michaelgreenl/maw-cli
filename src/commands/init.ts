import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { type CommandDefinition } from './shared.js';

interface PackageJson {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
    exports?: Record<string, unknown>;
}

interface WorkflowScaffold {
    packageName: string;
    workflow: string;
}

type WorkflowFiles = Record<'graph.ts' | 'config.json', string>;

interface WorkflowModule {
    scaffold: WorkflowScaffold;
    createScaffoldFiles: () => WorkflowFiles | Promise<WorkflowFiles>;
}

const PACKAGE_JSON = 'package.json';
const SCAFFOLD_EXPORT = './scaffold';
const IGNORED_PACKAGE = 'maw-cli';
const GITIGNORE_ENTRY = '.maw/openviking/';
const GRAPH_ROOT = '.maw/graphs';
const PROJECT_DIRS = ['.maw/templates', '.maw/graphs'] as const;
const LANGGRAPH_NODE = '20';
const ROOT_ENV = '../../../.env';

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
} as const;

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
} as const;

const dependencyFields = ['dependencies', 'devDependencies', 'optionalDependencies'] as const;

const formatJson = (value: unknown): string => `${JSON.stringify(value, null, 4)}\n`;

const fileExists = async (filePath: string): Promise<boolean> => {
    try {
        await access(filePath);
        return true;
    } catch {
        return false;
    }
};

const readJson = async <T>(filePath: string): Promise<T> => {
    const content = await readFile(filePath, 'utf8');
    return JSON.parse(content) as T;
};

const readPackageJson = (root: string): Promise<PackageJson> => {
    return readJson<PackageJson>(join(root, PACKAGE_JSON));
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null;
};

const getInstalledDependencyNames = (pkg: PackageJson): string[] => {
    const names = new Set<string>();

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

const resolveScaffoldExport = (exportsField: PackageJson['exports']): string | undefined => {
    const entry = exportsField?.[SCAFFOLD_EXPORT];

    if (typeof entry === 'string') {
        return entry;
    }

    if (!entry || typeof entry !== 'object') {
        return undefined;
    }

    const conditions = entry as Record<string, unknown>;

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

const isWorkflowModule = (value: Partial<WorkflowModule>): value is WorkflowModule =>
    typeof value.scaffold?.packageName === 'string' &&
    typeof value.scaffold?.workflow === 'string' &&
    typeof value.createScaffoldFiles === 'function';

const isWorkflowFiles = (value: unknown): value is WorkflowFiles => {
    if (!isRecord(value)) {
        return false;
    }

    return typeof value['graph.ts'] === 'string' && typeof value['config.json'] === 'string';
};

const createProjectFiles = (): Record<string, string> => ({
    'maw.json': formatJson(PROJECT_CFG),
    '.maw/ov.conf': formatJson(OV_CFG),
});

const langgraphJson = (name: string): string => {
    return formatJson({
        node_version: LANGGRAPH_NODE,
        graphs: { [name]: './graph.ts:graph' },
        env: ROOT_ENV,
    });
};

const workflowFiles = (name: string, files: WorkflowFiles): Record<string, string> => {
    const dir = join(GRAPH_ROOT, name);

    return {
        [join(dir, 'graph.ts')]: files['graph.ts'],
        [join(dir, 'config.json')]: files['config.json'],
        [join(dir, 'langgraph.json')]: langgraphJson(name),
    };
};

const tryLoadWorkflowModule = async (
    requireFromRoot: NodeRequire,
    packageName: string,
): Promise<WorkflowModule | null> => {
    try {
        const manifestPath = requireFromRoot.resolve(`${packageName}/${PACKAGE_JSON}`);
        const packageDir = dirname(manifestPath);
        const manifest = await readJson<PackageJson>(manifestPath);
        const scaffoldExport = resolveScaffoldExport(manifest.exports);

        if (!scaffoldExport) {
            return null;
        }

        const modulePath = join(packageDir, scaffoldExport);
        const loaded = (await import(pathToFileURL(modulePath).href)) as Partial<WorkflowModule>;

        return isWorkflowModule(loaded) ? loaded : null;
    } catch {
        return null;
    }
};

const sortWorkflows = (mods: WorkflowModule[]): WorkflowModule[] => {
    return mods.sort((left, right) => {
        const byWorkflow = left.scaffold.workflow.localeCompare(right.scaffold.workflow);

        if (byWorkflow !== 0) {
            return byWorkflow;
        }

        return left.scaffold.packageName.localeCompare(right.scaffold.packageName);
    });
};

const findDuplicateWorkflow = (mods: readonly WorkflowModule[]): string | null => {
    const seen = new Set<string>();

    for (const mod of mods) {
        const name = mod.scaffold.workflow;

        if (seen.has(name)) {
            return name;
        }

        seen.add(name);
    }

    return null;
};

export const loadWorkflows = async (root: string): Promise<WorkflowModule[]> => {
    const pkg = await readPackageJson(root);
    const requireFromRoot = createRequire(join(root, PACKAGE_JSON));
    const dependencyNames = getInstalledDependencyNames(pkg);
    const matches = await Promise.all(dependencyNames.map((name) => tryLoadWorkflowModule(requireFromRoot, name)));

    const mods = sortWorkflows(matches.filter((mod): mod is WorkflowModule => mod !== null));

    const duplicate = findDuplicateWorkflow(mods);

    if (duplicate) {
        throw new Error(`Duplicate workflow name: ${duplicate}`);
    }

    return mods;
};

const readWorkflowFiles = async (workflow: WorkflowModule): Promise<WorkflowFiles> => {
    const files = await workflow.createScaffoldFiles();

    if (isWorkflowFiles(files)) {
        return files;
    }

    throw new Error(`Invalid scaffold files from ${workflow.scaffold.packageName}.`);
};

const mergeGitignore = async (root: string, entries: readonly string[]): Promise<void> => {
    const gitignorePath = join(root, '.gitignore');
    const existing = (await fileExists(gitignorePath)) ? await readFile(gitignorePath, 'utf8') : '';

    const lines = new Set(existing.split('\n').filter(Boolean));

    for (const entry of entries) {
        lines.add(entry);
    }

    await writeFile(gitignorePath, `${[...lines].join('\n')}\n`);
};

const writeMissingFiles = async (root: string, files: Record<string, string>): Promise<void> => {
    for (const [relativePath, content] of Object.entries(files)) {
        const filePath = join(root, relativePath);

        if (await fileExists(filePath)) {
            continue;
        }

        await mkdir(dirname(filePath), { recursive: true });
        await writeFile(filePath, content);
    }
};

const ensureDirs = async (root: string, dirs: readonly string[]): Promise<void> => {
    for (const dir of dirs) {
        await mkdir(join(root, dir), { recursive: true });
    }
};

const writeWorkflows = async (root: string, mods: readonly WorkflowModule[]): Promise<void> => {
    for (const mod of mods) {
        const name = mod.scaffold.workflow;

        await mkdir(join(root, GRAPH_ROOT, name), { recursive: true });
        await writeMissingFiles(root, workflowFiles(name, await readWorkflowFiles(mod)));
    }
};

const workflowNames = (mods: readonly WorkflowModule[]): string => {
    return mods.map((mod) => mod.scaffold.workflow).join(', ');
};

export const runInit = async (_args: readonly string[], root = process.cwd()): Promise<number> => {
    try {
        const mods = await loadWorkflows(root);

        await ensureDirs(root, PROJECT_DIRS);
        await writeMissingFiles(root, createProjectFiles());
        await mergeGitignore(root, [GITIGNORE_ENTRY]);

        if (mods.length === 0) {
            process.stderr.write(
                'Warning: initialized project MAW scaffold without workflows. Install a workflow package and rerun `maw-cli init`.\n',
            );
            return 0;
        }

        await writeWorkflows(root, mods);

        process.stdout.write(`Initialized project MAW scaffold for workflows: ${workflowNames(mods)}.\n`);

        return 0;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`${message}\n`);
        return 1;
    }
};

export const initCommand: CommandDefinition<'init'> = {
    name: 'init',
    summary: 'Scaffold .maw/ config in target project',
    run: runInit,
};
