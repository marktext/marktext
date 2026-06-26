import type { TState } from '@muyajs/core';
import { expect, test } from '../fixtures/muya';
import { slowType } from '../helpers/keyboard';
import { editor, floats, quickInsertItem } from '../helpers/selectors';

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

/**
 * Quick-insert (slash menu) path for diagram blocks. The other tests in this
 * file (and the sibling diagram specs) drive `setContent` directly; the
 * narrowly-missing coverage is the QUICK-INSERT menu route a real user takes:
 * type `/`, filter, click the menu entry, then author the diagram body.
 *
 * The menu is the `paragraphQuickInsertMenu` plugin (registered by the host).
 * It shows when the focused `paragraph.content` text matches `/^[/、]\S*$/`
 * (config.ts `checkQuickInsert`), filters the entries with Fuse, and clicking
 * an item dispatches `replaceBlockByLabel(label)` — for `diagram mermaid` /
 * `diagram vega-lite` that swaps the paragraph for an empty diagram block of
 * the right `meta.type`/`meta.lang` and drops the caret into its code editor.
 *
 * The diagram code editor (`codeBlockContent`) auto-pairs brackets/quotes
 * (default `autoPairBracket`/`autoPairQuote`), so a vega-lite JSON body typed
 * key-by-key would double its `{`/`"`. We therefore type only the
 * bracket/quote-free mermaid body through real keystrokes, and author the
 * vega-lite body via the freshly-inserted active code block's text setter
 * (still exercising the quick-insert insertion + live preview render).
 *
 * Floats never set `display:none` — `hide()` only zeroes the inline opacity
 * and parks the box off-screen (baseFloat.ts), and Playwright's `toBeHidden`
 * ignores opacity. So the reliable "the menu acted" signal is that the
 * diagram block was inserted, mirroring ui/slash-menu.spec.ts which asserts on
 * the inserted block rather than the float's visibility.
 */
test.describe('diagram via quick-insert menu', () => {
    // A bracket/quote-free mermaid body types cleanly through real keystrokes
    // without tripping the code editor's auto-pair.
    const MERMAID_BODY = 'graph TD\nA-->B';

    // Reset to a single empty paragraph, focus it, then trigger the slash menu
    // narrowed by `filter` so the target diagram entry is unambiguous.
    async function openQuickInsert(page: import('@playwright/test').Page, filter: string) {
        await page.evaluate(() => window.muya!.setContent(''));
        await page.locator(editor.paragraph).first().click();
        await page.keyboard.type('/');
        await expect(page.locator(floats.quickInsert)).toBeVisible();
        await slowType(page, filter);
    }

    test('inserting a mermaid diagram from the slash menu renders an <svg>', async ({ page }) => {
        await openQuickInsert(page, 'mermaid');

        // Click the diagram entry — `data-label="diagram mermaid"`.
        const item = page.locator(quickInsertItem('diagram mermaid'));
        await expect(item).toBeVisible();
        await item.click();

        // The paragraph is now an empty diagram block; the caret sits in its
        // code editor. Type the body via real keystrokes.
        await expect(page.locator(editor.diagramBlock)).toHaveCount(1);
        await slowType(page, MERMAID_BODY);

        // The preview updates live on input; allow generous time for the async
        // mermaid render (dynamic import + parse + run).
        const svg = page.locator(`${editor.diagramPreview} svg`).first();
        await expect(svg).toBeVisible({ timeout: 15_000 });

        // The fence language round-trips back to ```mermaid carrying the body.
        const md = await page.evaluate(() => window.muya!.getMarkdown());
        expect(md).toContain('```mermaid');
        expect(md).toContain('graph TD');
        expect(md).toContain('A-->B');
    });

    test('inserting a vega-lite diagram from the slash menu renders an <svg>', async ({ page }) => {
        await openQuickInsert(page, 'vega');

        // Click the diagram entry — `data-label="diagram vega-lite"`.
        const item = page.locator(quickInsertItem('diagram vega-lite'));
        await expect(item).toBeVisible();
        await item.click();

        await expect(page.locator(editor.diagramBlock)).toHaveCount(1);

        // The empty quick-inserted diagram serializes as a vega-lite fence with
        // `meta.lang: 'json'` (buildDiagramBlock) before any body is authored.
        // The in-place replace settles a tick after the DOM node mounts, so
        // poll the serialized markdown rather than reading it once.
        await expect
            .poll(() => page.evaluate(() => window.muya!.getMarkdown()))
            .toContain('```vega-lite');

        // Author the JSON body on the freshly-inserted code block — typing it
        // key-by-key would trip the editor's `{`/`"` auto-pair. The caret was
        // placed in the diagram's code editor on insert, so its `outContainer`
        // is the diagram block and `attachments.head` is the live preview;
        // writing the text then calling `preview.update(text)` is exactly the
        // path the engine's own `_updatePreviewIfHave` runs on every keystroke.
        const spec = JSON.stringify({
            $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
            data: { values: [{ a: 'A', b: 28 }, { a: 'B', b: 55 }, { a: 'C', b: 43 }] },
            mark: 'bar',
            encoding: {
                x: { field: 'a', type: 'nominal' },
                y: { field: 'b', type: 'quantitative' },
            },
        });
        await page.evaluate((text) => {
            const block = window.muya!.editor.activeContentBlock as unknown as {
                text: string;
                outContainer?: { attachments?: { head?: { update: (code: string) => void } } };
            } | null;
            block!.text = text;
            block!.outContainer?.attachments?.head?.update(text);
        }, spec);

        // Vega-Lite renders asynchronously to an `<svg>` with mark elements.
        const svg = page.locator(`${editor.diagramPreview} svg`).first();
        await expect(svg).toBeVisible({ timeout: 15_000 });
        const markCount = await page.evaluate(() => {
            const root = document.querySelector('.mu-diagram-preview svg');
            return root ? root.querySelectorAll('path, rect').length : 0;
        });
        expect(markCount).toBeGreaterThan(0);

        // The fence language round-trips back to ```vega-lite carrying the body.
        const md = await page.evaluate(() => window.muya!.getMarkdown());
        expect(md).toContain('```vega-lite');
        expect(md).toContain('"mark":"bar"');
        expect(md.trim().endsWith('```')).toBe(true);
    });
});
