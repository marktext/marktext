import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readme = readFileSync(new URL('../../README.md', import.meta.url), 'utf8');
const quickStart = readme.match(/## Quick start[\s\S]*?## API at a glance/)?.[0] ?? '';
const pluginTable = readme.match(/## Bundled UI plugins[\s\S]*?## Architecture/)?.[0] ?? '';

describe('readme plugin registration', () => {
    it('registers the pickers required by the documented image and table flows', () => {
        expect(quickStart).toContain('Muya.use(ImagePathPicker);');
        expect(quickStart).toContain('imagePathAutoComplete:');
        expect(quickStart).toContain('Muya.use(TableChessboard);');
        expect(pluginTable).toContain('| `ImagePathPicker` |');
        expect(pluginTable).toContain('| `TableChessboard` |');
    });
});
