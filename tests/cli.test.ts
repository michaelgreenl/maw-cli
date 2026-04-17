import { describe, expect, it } from 'vitest';
import { COMMAND_NAMES, formatHelp, parseCommandName } from '../src/index.js';

describe('cli', () => {
    it('advertises the current command surface', () => {
        expect(COMMAND_NAMES).toEqual(['init', 'dev', 'ov:init', 'ov:index']);

        const help = formatHelp();

        expect(help).toContain('maw-cli init');
        expect(help).toContain('maw-cli dev <workflow>');
        expect(help).not.toContain('maw-cli start');
        expect(help).toContain('maw-cli ov:init');
        expect(help).toContain('maw-cli ov:index');
    });

    it('parses nested ov commands and rejects start', () => {
        expect(parseCommandName(['ov:init'])).toBe('ov:init');
        expect(parseCommandName(['ov:index'])).toBe('ov:index');
        expect(parseCommandName(['start'])).toBeUndefined();
        expect(parseCommandName([])).toBeUndefined();
    });
});
