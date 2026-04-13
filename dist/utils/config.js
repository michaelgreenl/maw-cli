import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
const DIR = '.maw';
const FILE = 'config.json';
const ENV = /\$\{(\w+)\}/g;
const isRecord = (value) => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};
const resolveString = (value) => {
    return value.replace(ENV, (_match, name) => {
        const env = process.env[name];
        if (env === undefined) {
            throw new Error(`Environment variable ${name} is not set but referenced in .maw/config.json`);
        }
        return env;
    });
};
const resolveEnvVars = (obj) => {
    const resolved = {};
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
export const readConfig = async (root) => {
    const file = join(root, DIR, FILE);
    try {
        await access(file);
    }
    catch {
        throw new Error(`Config file not found: ${file}`);
    }
    const cfg = JSON.parse(await readFile(file, 'utf8'));
    return resolveEnvVars(cfg);
};
