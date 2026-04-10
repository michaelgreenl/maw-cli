import { describe, expect, it } from 'vitest';
import { COMMAND_NAMES, formatHelp, parseCommandName } from '../src/index.js';

describe('cli', () => {
    it('advertises the planned command surface', () => {
        expect(COMMAND_NAMES).toEqual(['init', 'dev', 'start', 'ov:init', 'ov:index']);

        const help = formatHelp();

        expect(help).toContain('maw-cli init');
        expect(help).toContain('maw-cli dev');
        expect(help).toContain('maw-cli start');
        expect(help).toContain('maw-cli ov:init');
        expect(help).toContain('maw-cli ov:index');
    });

    it('parses nested ov commands', () => {
        expect(parseCommandName(['ov:init'])).toBe('ov:init');
        expect(parseCommandName(['ov:index'])).toBe('ov:index');
        expect(parseCommandName([])).toBeUndefined();
    });
});
