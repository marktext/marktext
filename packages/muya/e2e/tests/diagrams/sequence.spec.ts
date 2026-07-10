import type { TState } from '@muyajs/core';
import { expect, test } from '../fixtures/muya';
import { editor } from '../helpers/selectors';

/**
 * js-sequence-diagrams rendering. The sequence loader (packages/core/src/utils/
 * diagram/sequence/index.ts) vendors `js-sequence-diagrams` wired to snap.svg:
 * `render.parse(code)` returns a diagram whose `drawSVG(target, { theme })`
 * appends a `<svg>` into the diagram preview. Everything is client-side — no
 * network, no mock needed (unlike plantuml.spec.ts).
 *
 * The vendored renderer tags every emitted `<svg>` with the `sequence` class
 * plus the active theme's css-class (`hand` | `simple`) — see
 * packages/core/src/utils/diagram/sequence/sequence-diagram-snap.js
 * (`paper_.addClass('sequence')` then `addClass(this.cssClass_)`).
 */

const SEQUENCE_SOURCE = 'A->B: hello';

function sequenceState(text: string): TState[] {
    return [{
        name: 'diagram',
        text,
        meta: { lang: 'yaml', type: 'sequence' },
    }];
}

test.describe('sequence diagram', () => {
    test('setContent with a sequence diagram mounts an <svg> under the preview', async ({ page }) => {
        await page.evaluate((state) => {
            window.muya!.setContent(state);
        }, sequenceState(SEQUENCE_SOURCE));

        const svg = page.locator(`${editor.diagramPreview} svg`).first();
        await expect(svg).toBeVisible({ timeout: 15_000 });

        await expect(svg).toHaveClass(/sequence/);
    });

    test('sequence diagram round-trips through getMarkdown', async ({ page }) => {
        await page.evaluate((state) => {
            window.muya!.setContent(state);
        }, sequenceState(SEQUENCE_SOURCE));

        // Wait for the svg as a sync barrier before reading markdown.
        await expect(page.locator(`${editor.diagramPreview} svg`).first())
            .toBeVisible({ timeout: 15_000 });

        const md = await page.evaluate(() => window.muya!.getMarkdown());
        expect(md).toContain('```sequence');
        expect(md).toContain('A->B: hello');
        expect(md.trim().endsWith('```')).toBe(true);
    });

    test('default sequenceTheme is `hand` and the svg carries the hand css-class', async ({ page }) => {
        // The host boots Muya without an explicit sequenceTheme, so the default
        // (`hand`, per MUYA_DEFAULT_OPTIONS) is in effect.
        const theme = await page.evaluate(() => window.muya!.options.sequenceTheme);
        expect(theme).toBe('hand');

        await page.evaluate((state) => {
            window.muya!.setContent(state);
        }, sequenceState(SEQUENCE_SOURCE));

        const svg = page.locator(`${editor.diagramPreview} svg`).first();
        await expect(svg).toBeVisible({ timeout: 15_000 });
        await expect(svg).toHaveClass(/\bhand\b/);
    });

    test('sequenceTheme `simple` re-renders with the simple css-class', async ({ page }) => {
        // Rebuild Muya with the `simple` theme, then render the same diagram.
        await page.evaluate(() => {
            window.__e2e!.rebuildMuya({ sequenceTheme: 'simple' });
        });

        const theme = await page.evaluate(() => window.muya!.options.sequenceTheme);
        expect(theme).toBe('simple');

        await page.evaluate((state) => {
            window.muya!.setContent(state);
        }, sequenceState(SEQUENCE_SOURCE));

        const svg = page.locator(`${editor.diagramPreview} svg`).first();
        await expect(svg).toBeVisible({ timeout: 15_000 });
        await expect(svg).toHaveClass(/\bsimple\b/);
        // The hand-drawn theme's class must not leak onto the simple render.
        await expect(svg).not.toHaveClass(/\bhand\b/);
    });
});
