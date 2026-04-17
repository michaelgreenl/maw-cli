import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const FILE = 'maw.json';

export interface MawProjectConfig {
    workspace: string;
    openviking: {
        enabled: boolean;
        host: string;
        port: number;
    };
    templates: {
        customPath: string;
    };
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const invalid = (field: string): Error => {
    return new Error(`Invalid config: missing ${field}`);
};

const parseString = (value: unknown, field: string): string => {
    if (typeof value !== 'string') {
        throw invalid(field);
    }

    return value;
};

const parseConfig = (value: unknown): MawProjectConfig => {
    if (!isRecord(value)) {
        throw invalid('root');
    }

    const openviking = value.openviking;
    const templates = value.templates;

    if (!isRecord(openviking)) {
        throw invalid('openviking');
    }

    if (!isRecord(templates)) {
        throw invalid('templates');
    }

    if (typeof openviking.enabled !== 'boolean') {
        throw invalid('openviking.enabled');
    }

    if (typeof openviking.port !== 'number') {
        throw invalid('openviking.port');
    }

    return {
        workspace: parseString(value.workspace, 'workspace'),
        openviking: {
            enabled: openviking.enabled,
            host: parseString(openviking.host, 'openviking.host'),
            port: openviking.port,
        },
        templates: {
            customPath: parseString(templates.customPath, 'templates.customPath'),
        },
    };
};

export const ensureConfig = async (root: string): Promise<string> => {
    const file = join(root, FILE);

    try {
        await access(file);
    } catch {
        throw new Error(`Config file not found: ${file}`);
    }

    const raw: unknown = JSON.parse(await readFile(file, 'utf8'));
    parseConfig(raw);

    return file;
};

export const readConfig = async (root: string): Promise<MawProjectConfig> => {
    const file = join(root, FILE);

    try {
        await access(file);
    } catch {
        throw new Error(`Config file not found: ${file}`);
    }

    const raw: unknown = JSON.parse(await readFile(file, 'utf8'));

    return parseConfig(raw);
};
