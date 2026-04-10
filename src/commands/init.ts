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
    directories: readonly string[];
    gitignore: readonly string[];
}

interface WorkflowModule {
    scaffold: WorkflowScaffold;
    createScaffoldFiles: (packageName?: string) => Record<string, string> | Promise<Record<string, string>>;
}

const PACKAGE_JSON = 'package.json';
const SCAFFOLD_EXPORT = './scaffold';
const IGNORED_PACKAGE = 'maw-cli';

const dependencyFields = ['dependencies', 'devDependencies', 'optionalDependencies'] as const;

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
    Boolean(value.scaffold) && typeof value.createScaffoldFiles === 'function';

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

const loadWorkflow = async (root: string): Promise<WorkflowModule> => {
    const pkg = await readPackageJson(root);
    const requireFromRoot = createRequire(join(root, PACKAGE_JSON));
    const dependencyNames = getInstalledDependencyNames(pkg);

    const matches = (
        await Promise.all(dependencyNames.map((name) => tryLoadWorkflowModule(requireFromRoot, name)))
    ).filter((mod): mod is WorkflowModule => mod !== null);

    if (matches.length === 1) {
        return matches[0];
    }

    if (matches.length === 0) {
        throw new Error('No installed workflow package exposes the MAW scaffold contract.');
    }

    throw new Error('Multiple installed workflow packages expose the MAW scaffold contract.');
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

export const runInit = async (_args: readonly string[], root = process.cwd()): Promise<number> => {
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
