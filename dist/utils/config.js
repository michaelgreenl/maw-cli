import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
const FILE = 'maw.json';
const isRecord = (value) => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};
const invalid = (field) => {
    return new Error(`Invalid config: missing ${field}`);
};
const parseString = (value, field) => {
    if (typeof value !== 'string') {
        throw invalid(field);
    }
    return value;
};
const parseBoolean = (value, field) => {
    if (typeof value !== 'boolean') {
        throw invalid(field);
    }
    return value;
};
const parseNumber = (value, field) => {
    if (typeof value !== 'number') {
        throw invalid(field);
    }
    return value;
};
const parseConfig = (value) => {
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
    return {
        workspace: parseString(value.workspace, 'workspace'),
        openviking: {
            enabled: parseBoolean(openviking.enabled, 'openviking.enabled'),
            host: parseString(openviking.host, 'openviking.host'),
            port: parseNumber(openviking.port, 'openviking.port'),
        },
        templates: {
            customPath: parseString(templates.customPath, 'templates.customPath'),
        },
    };
};
const loadConfig = async (root) => {
    const file = join(root, FILE);
    try {
        await access(file);
    }
    catch {
        throw new Error(`Config file not found: ${file}`);
    }
    const cfg = parseConfig(JSON.parse(await readFile(file, 'utf8')));
    return { file, cfg };
};
export const ensureConfig = async (root) => {
    const { file } = await loadConfig(root);
    return file;
};
export const readConfig = async (root) => {
    const { cfg } = await loadConfig(root);
    return cfg;
};
