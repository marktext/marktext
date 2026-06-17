import type { TState } from '@muyajs/core';
import { expect, test } from '../fixtures/muya';
import { editor } from '../helpers/selectors';

/**
 * Mermaid diagram rendering. Unlike PlantUML (which round-trips through the
 * public plantuml.com service), mermaid renders entirely client-side: the
 * diagram preview block (packages/core/src/block/extra/diagram/
 * diagramPreview.ts) lazy-imports `mermaid`, calls `mermaid.parse(code)` to
 * validate, then `mermaid.run({ nodes: [target] })` to mount an `<svg>`.
 *
 * No network mock is needed. The render is async (dynamic import + parse +
 * run), so every assertion waits on an explicit DOM condition rather than a
 * fixed sleep.
 */

const VALID_MERMAID = 'graph TD\n    A-->B';

// A truncated edge (`A--->` with no target) is rejected by `mermaid.parse`,
// which the preview block catches and surfaces as an error node instead of
// throwing.
const INVALID_MERMAID = 'graph TD\n    A--->';

test.describe('mermaid diagram', () => {
    test('setContent with a valid graph mounts an <svg> under the preview', async ({ page }) => {
        await page.evaluate((text) => {
            window.muya!.setContent([{
                name: 'diagram',
                text,
                meta: { lang: 'yaml', type: 'mermaid' },
            }] as TState[]);
        }, VALID_MERMAID);

        // Mermaid is async (dynamic import + parse + run); allow generous time.
        const svg = page.locator(`${editor.diagramPreview} svg`).first();
        await expect(svg).toBeVisible({ timeout: 15_000 });

        // A `graph TD; A-->B` renders two node groups plus an edge path. Mermaid
        // populates the shapes a tick after the `<svg>` shell mounts, so poll
        // for the geometry rather than snapshotting it once.
        await page.waitForFunction(() => {
            const root = document.querySelector('.mu-diagram-preview svg');
            if (!root)
                return false;
            return root.querySelectorAll('path, rect, polygon, .node').length > 0;
        }, undefined, { timeout: 15_000 });
    });

    test('mermaid diagram round-trips through getMarkdown', async ({ page }) => {
        await page.evaluate((text) => {
            window.muya!.setContent([{
                name: 'diagram',
                text,
                meta: { lang: 'yaml', type: 'mermaid' },
            }] as TState[]);
        }, VALID_MERMAID);

        // Use the SVG mount as a sync barrier before reading markdown back.
        await expect(page.locator(`${editor.diagramPreview} svg`).first())
            .toBeVisible({ timeout: 15_000 });

        const md = await page.evaluate(() => window.muya!.getMarkdown());
        expect(md).toContain('```mermaid');
        expect(md).toContain('graph TD');
        expect(md).toContain('A-->B');
        expect(md.trim().endsWith('```')).toBe(true);
    });

    test('invalid mermaid code surfaces an error node instead of crashing', async ({ page }) => {
        await page.evaluate((text) => {
            window.muya!.setContent([{
                name: 'diagram',
                text,
                meta: { lang: 'yaml', type: 'mermaid' },
            }] as TState[]);
        }, INVALID_MERMAID);

        // The preview block catches the parse rejection and writes a
        // `.mu-diagram-error` node carrying the localized 'Invalid Diagram
        // Code' label (host loads the `en` locale, so it is literal English).
        const error = page.locator(`${editor.diagramPreview} ${editor.diagramError}`).first();
        await expect(error).toBeVisible({ timeout: 15_000 });
        await expect(error).toContainText('Invalid Diagram Code');

        // No SVG should have mounted for a failed parse.
        await expect(page.locator(`${editor.diagramPreview} svg`)).toHaveCount(0);

        // The editor stays alive (no thrown crash): the source still round-trips.
        const md = await page.evaluate(() => window.muya!.getMarkdown());
        expect(md).toContain('```mermaid');
    });

    test('rebuilding with a non-default mermaidTheme still renders an SVG', async ({ page }) => {
        // `mermaidTheme` is read fresh from `muya.options` on each preview
        // update (diagramPreview.ts), but the only deterministic way to change
        // it e2e is to rebuild the editor with the new option, then re-render.
        await page.evaluate(() => {
            window.__e2e!.rebuildMuya({ mermaidTheme: 'forest' });
        });
        await page.waitForFunction(
            () => window.muya?.editor?.scrollPage != null,
            undefined,
            { timeout: 15_000 },
        );

        await page.evaluate((text) => {
            window.muya!.setContent([{
                name: 'diagram',
                text,
                meta: { lang: 'yaml', type: 'mermaid' },
            }] as TState[]);
        }, VALID_MERMAID);

        await expect(page.locator(`${editor.diagramPreview} svg`).first())
            .toBeVisible({ timeout: 15_000 });

        // The diagram still serializes back to a mermaid fence under the new
        // theme — the theme is a render-time option, not part of the source.
        const md = await page.evaluate(() => window.muya!.getMarkdown());
        expect(md).toContain('```mermaid');
        expect(md).toContain('graph TD');
    });
});
