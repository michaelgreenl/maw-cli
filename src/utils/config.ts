import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const DIR = '.maw';
const FILE = 'config.json';
const ENV = /\$\{(\w+)\}/g;

export interface MawConfig {
    workspace: string;
    graph: {
        name: string;
        agent?: string;
    };
    openviking: {
        enabled: boolean;
        host: string;
        port: number;
    };
    llm: {
        provider: string;
        apiKey: string;
    };
    templates: {
        sources: string[];
        customPath: string;
        gitRepos: string[];
        globalSnippets: string[];
        agents: Record<string, { snippets: string[] }>;
    };
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const resolveString = (value: string): string => {
    return value.replace(ENV, (_match, name: string) => {
        const env = process.env[name];

        if (env === undefined) {
            throw new Error(`Environment variable ${name} is not set but referenced in .maw/config.json`);
        }

        return env;
    });
};

const resolveEnvVars = (obj: Record<string, unknown>): Record<string, unknown> => {
    const resolved: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
            resolved[key] = resolveString(value);
            continue;
        }

        if (isRecord(value)) {
            resolved[key] = resolveEnvVars(value);
            continue;
        }

        resolved[key] = value;
    }

    return resolved;
};

export const readConfig = async (root: string): Promise<MawConfig> => {
    const file = join(root, DIR, FILE);

    try {
        await access(file);
    } catch {
        throw new Error(`Config file not found: ${file}`);
    }

    const cfg = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>;

    return resolveEnvVars(cfg) as unknown as MawConfig;
};
