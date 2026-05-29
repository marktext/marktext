import type { TState } from '@muyajs/core';
import { expect, test } from '../fixtures/muya';
import { editor } from '../helpers/selectors';

/**
 * A minimal valid Vega-Lite v5 spec — small enough that rendering is fast
 * but still produces SVG `<rect>` marks we can count.
 */
const VEGA_LITE_SPEC = JSON.stringify({
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    description: 'A simple bar chart with embedded data.',
    data: {
        values: [
            { a: 'A', b: 28 },
            { a: 'B', b: 55 },
            { a: 'C', b: 43 },
        ],
    },
    mark: 'bar',
    encoding: {
        x: { field: 'a', type: 'nominal' },
        y: { field: 'b', type: 'quantitative' },
    },
});

test.describe('vega-lite diagram', () => {
    test('setContent with a vega-lite diagram renders an SVG with marks', async ({ page }) => {
        await page.evaluate((text) => {
            const state: TState[] = [{
                name: 'diagram',
                text,
                meta: { lang: 'json', type: 'vega-lite' },
            }];
            window.muya!.setContent(state);
        }, VEGA_LITE_SPEC);

        // Vega-Lite renders asynchronously; allow up to 15s for the SVG.
        const svg = page.locator(`${editor.diagramPreview} svg`).first();
        await expect(svg).toBeVisible({ timeout: 15_000 });

        // A 3-bar bar chart should yield at least 3 path/rect mark elements
        // inside the rendered SVG. We use a permissive selector so a future
        // theme change between `<rect>` and `<path>` doesn't regress us.
        const markCount = await page.evaluate(() => {
            const root = document.querySelector('.mu-diagram-preview svg');
            if (!root)
                return 0;
            return root.querySelectorAll('path, rect').length;
        });
        expect(markCount).toBeGreaterThan(0);
    });

    test('vega-lite round-trips through getMarkdown', async ({ page }) => {
        await page.evaluate((text) => {
            const state: TState[] = [{
                name: 'diagram',
                text,
                meta: { lang: 'json', type: 'vega-lite' },
            }];
            window.muya!.setContent(state);
        }, VEGA_LITE_SPEC);

        // Wait for the SVG to mount as a sync barrier before reading markdown.
        await expect(page.locator(`${editor.diagramPreview} svg`).first())
            .toBeVisible({ timeout: 15_000 });

        const md = await page.evaluate(() => window.muya!.getMarkdown());
        // The diagram serializes as a fenced block with the `vega-lite` tag.
        // The body is whatever string we passed to `text` — for our spec that
        // is `JSON.stringify(...)` with no extra whitespace.
        expect(md).toContain('```vega-lite');
        expect(md).toContain('"mark":"bar"');
        expect(md.trim().endsWith('```')).toBe(true);
    });
});
