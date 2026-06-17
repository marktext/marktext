import type { TState } from '@muyajs/core';
import { expect, test } from '../fixtures/muya';
import { editor } from '../helpers/selectors';

/**
 * flowchart.js diagram rendering. The flowchart loader (packages/core/src/
 * utils/diagram/index.ts) imports `flowchart.js`, calls `parse(code)` and then
 * `diagram.drawSVG(target, options)` (see block/extra/diagram/diagramPreview.ts).
 * flowchart.js draws through Raphael, which mounts a single `<svg>` element into
 * the `.mu-diagram-preview` target.
 *
 * Unlike PlantUML this is fully client-side — no network, no mock. We assert the
 * SVG mount and the markdown round-trip (the diagram serializes back to a
 * ```flowchart fenced block carrying the original source).
 */

const FLOWCHART_SOURCE = 'st=>start: Start\ne=>end: End\nst->e';

test.describe('flowchart diagram', () => {
    test('setContent with a flowchart diagram mounts an SVG in the preview', async ({ page }) => {
        await page.evaluate((text) => {
            const state: TState[] = [{
                name: 'diagram',
                text,
                meta: { lang: 'yaml', type: 'flowchart' },
            }];
            window.muya!.setContent(state);
        }, FLOWCHART_SOURCE);

        // flowchart.js draws the SVG synchronously after the loader resolves the
        // dynamic import. Wait for the `<svg>` to mount under the preview.
        const svg = page.locator(`${editor.diagramPreview} svg`).first();
        await expect(svg).toBeVisible({ timeout: 15_000 });

        // A start -> end flow yields at least a couple of shape/connector
        // elements. Use a permissive selector so a Raphael internal change
        // (rect vs path) doesn't regress us.
        const markCount = await page.evaluate(() => {
            const root = document.querySelector('.mu-diagram-preview svg');
            if (!root)
                return 0;
            return root.querySelectorAll('path, rect, text').length;
        });
        expect(markCount).toBeGreaterThan(0);
    });

    test('flowchart round-trips through getMarkdown', async ({ page }) => {
        await page.evaluate((text) => {
            const state: TState[] = [{
                name: 'diagram',
                text,
                meta: { lang: 'yaml', type: 'flowchart' },
            }];
            window.muya!.setContent(state);
        }, FLOWCHART_SOURCE);

        // Wait for the SVG to mount as a sync barrier before reading markdown.
        await expect(page.locator(`${editor.diagramPreview} svg`).first())
            .toBeVisible({ timeout: 15_000 });

        const md = await page.evaluate(() => window.muya!.getMarkdown());
        // The diagram serializes as a fenced block with the `flowchart` tag,
        // carrying the source lines we passed in.
        expect(md).toContain('```flowchart');
        expect(md).toContain('st=>start: Start');
        expect(md).toContain('e=>end: End');
        expect(md).toContain('st->e');
        expect(md.trim().endsWith('```')).toBe(true);
    });
});
