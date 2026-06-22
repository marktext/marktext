import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// #4466: the light-theme editor TEXT colors used a semi-transparent alpha
// channel (`rgb(0 0 0 / 70%)` …). Alpha-composited text forces Chromium into
// grayscale antialiasing, so body text rendered aliased / thinner on FHD
// displays. Keep the @muyajs/core light-theme editor text colors opaque so
// font rendering stays crisp. Translucent overlays (selection / highlight)
// intentionally keep their alpha and are not covered here.
const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, '../index.css'), 'utf8');

const TEXT_COLOR_VARS = [
    '--editor-color',
    '--editor-color-80',
    '--editor-color-50',
    '--editor-color-30',
    '--editor-color-10',
    '--editor-color-04',
];

describe('light-theme editor text colors are opaque (#4466)', () => {
    for (const name of TEXT_COLOR_VARS) {
        it(`${name} has no alpha channel`, () => {
            const match = css.match(new RegExp(`${name}:\\s*([^;]+);`));
            expect(match, `${name} declaration not found`).toBeTruthy();
            const value = match![1].trim();
            expect(value, `${name} = ${value}`).not.toMatch(/rgba|hsla|\//i);
        });
    }
});
