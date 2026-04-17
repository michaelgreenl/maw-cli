import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { type CommandDefinition } from './shared.js';
import { createWorkflowLanggraphJson } from '../utils/langgraph.js';

interface PackageJson {
    dependencies?: unknown;
    devDependencies?: unknown;
    optionalDependencies?: unknown;
    exports?: unknown;
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
} as const;

const dependencyFields = ['dependencies', 'devDependencies', 'optionalDependencies'] as const;

const formatJson = (value: unknown): string => `${JSON.stringify(value, null, 4)}\n`;

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const parsePackageJson = (value: unknown): PackageJson => {
    if (!isRecord(value)) {
        throw new Error(`Invalid ${PACKAGE_JSON}.`);
    }

    return value;
};

const parseWorkflowFiles = (value: unknown, pkg: string): WorkflowFiles => {
    if (!isRecord(value) || typeof value['graph.ts'] !== 'string' || typeof value['config.json'] !== 'string') {
        throw new Error(`Invalid scaffold files from ${pkg}.`);
    }

    return {
        'graph.ts': value['graph.ts'],
        'config.json': value['config.json'],
    };
};

const getInstalledDependencyNames = (pkg: PackageJson): string[] => {
    const names = new Set<string>();

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

const resolveScaffoldExport = (exportsField: PackageJson['exports']): string | undefined => {
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

const tryLoadWorkflowModule = async (
    requireFromRoot: NodeRequire,
    packageName: string,
): Promise<WorkflowModule | null> => {
    try {
        const manifestPath = requireFromRoot.resolve(`${packageName}/${PACKAGE_JSON}`);
        const packageDir = dirname(manifestPath);
        const manifest = parsePackageJson(JSON.parse(await readFile(manifestPath, 'utf8')));
        const scaffoldExport = resolveScaffoldExport(manifest.exports);

        if (!scaffoldExport) {
            return null;
        }

        const modulePath = join(packageDir, scaffoldExport);
        const loaded: unknown = await import(pathToFileURL(modulePath).href);

        if (!isRecord(loaded) || !isRecord(loaded.scaffold)) {
            return null;
        }

        if (
            typeof loaded.scaffold.packageName !== 'string' ||
            typeof loaded.scaffold.workflow !== 'string' ||
            typeof loaded.createScaffoldFiles !== 'function'
        ) {
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
    } catch {
        return null;
    }
};

export const loadWorkflows = async (root: string): Promise<WorkflowModule[]> => {
    const pkg = parsePackageJson(JSON.parse(await readFile(join(root, PACKAGE_JSON), 'utf8')));
    const requireFromRoot = createRequire(join(root, PACKAGE_JSON));
    const dependencyNames = getInstalledDependencyNames(pkg);
    const matches = await Promise.all(dependencyNames.map((name) => tryLoadWorkflowModule(requireFromRoot, name)));

    const mods = matches
        .filter((mod): mod is WorkflowModule => mod !== null)
        .sort((left, right) => {
            const byWorkflow = left.scaffold.workflow.localeCompare(right.scaffold.workflow);

            if (byWorkflow !== 0) {
                return byWorkflow;
            }

            return left.scaffold.packageName.localeCompare(right.scaffold.packageName);
        });

    const seen = new Set<string>();

    for (const mod of mods) {
        const name = mod.scaffold.workflow;

        if (seen.has(name)) {
            throw new Error(`Duplicate workflow name: ${name}`);
        }

        seen.add(name);
    }

    return mods;
};

const mergeGitignore = async (root: string, entries: readonly string[]): Promise<void> => {
    const gitignorePath = join(root, '.gitignore');
    const existing = await readFile(gitignorePath, 'utf8').catch(() => '');

    const lines = new Set(existing.split('\n').filter(Boolean));

    for (const entry of entries) {
        lines.add(entry);
    }

    await writeFile(gitignorePath, `${[...lines].join('\n')}\n`);
};

const writeMissingFiles = async (root: string, files: Record<string, string>): Promise<void> => {
    for (const [relativePath, content] of Object.entries(files)) {
        const filePath = join(root, relativePath);

        try {
            await access(filePath);
            continue;
        } catch {
            await mkdir(dirname(filePath), { recursive: true });
            await writeFile(filePath, content);
        }
    }
};

const writeWorkflows = async (root: string, mods: readonly WorkflowModule[]): Promise<void> => {
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

export const runInit = async (_args: readonly string[], root = process.cwd()): Promise<number> => {
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
            process.stderr.write(
                'Warning: initialized project MAW scaffold without workflows. Install a workflow package and rerun `maw-cli init`.\n',
            );
            return 0;
        }

        await writeWorkflows(root, mods);

        process.stdout.write(
            `Initialized project MAW scaffold for workflows: ${mods.map((mod) => mod.scaffold.workflow).join(', ')}.\n`,
        );

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
