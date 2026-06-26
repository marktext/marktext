import type { TState } from '@muyajs/core';
import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { editor } from '../helpers/selectors';

/**
 * `disableHtml: true` option.
 *
 * Source of truth: `packages/core/src/block/commonMark/html/index.ts`
 * pushes the `mu-disable-html-render` class onto the html-block element,
 * and `packages/core/src/utils/index.ts::sanitize` escapes the HTML
 * before passing it through DOMPurify when the flag is set. The
 * combined effect is that markup inside an html-block is shown as
 * source rather than rendered as live HTML.
 *
 * What we verify:
 *   1. The wrapper div gets the `mu-disable-html-render` class.
 *   2. The preview pane's `innerHTML` does NOT contain a parsed
 *      `<div class="injected">` (which would mean the HTML rendered).
 *      Instead, the escaped source must appear as text.
 */
test.describe('options / disableHtml', () => {
    test('disableHtml: true — html block is flagged and HTML is not rendered live', async ({ page }) => {
        await page.evaluate(() => {
            window.__e2e!.rebuildMuya({ disableHtml: true });
            // setContent with a top-level html block. The IHtmlBlockState
            // shape is `{ name: 'html-block', text: '<div ...>...</div>' }`.
            window.muya!.setContent([{
                name: 'html-block',
                text: '<div class="injected"><span class="inside">payload</span></div>',
            }] as TState[]);
        });

        // The html-block wrapper carries both `.mu-html-block` and the
        // `.mu-disable-html-render` flag class.
        const wrapper = page.locator(editor.htmlBlock).first();
        await expect(wrapper).toBeVisible();
        await expect(wrapper).toHaveClass(/mu-disable-html-render/);

        // The preview pane should not contain a parsed .injected div —
        // its text-content should show the escaped tags instead.
        const preview = wrapper.locator(editor.htmlPreview);
        // The preview innerHTML must not contain the live `<div class="injected">`.
        const previewInnerHtml = await preview.evaluate(el => el.innerHTML);
        expect(previewInnerHtml).not.toContain('<div class="injected">');
        // Visible text should contain the raw markup (entity-escaped) — at
        // minimum the tag name and the payload word.
        await expect(preview).toContainText('payload');
        await expect(preview).toContainText('div');
    });

    test('disableHtml: false (default) — same content renders the inner <div>', async ({ page }) => {
        await page.evaluate(() => {
            window.__e2e!.rebuildMuya({ disableHtml: false });
            window.muya!.setContent([{
                name: 'html-block',
                text: '<div class="injected"><span class="inside">payload</span></div>',
            }] as TState[]);
        });

        const wrapper = page.locator(editor.htmlBlock).first();
        await expect(wrapper).toBeVisible();
        // The disable class must NOT be present.
        const className = await wrapper.evaluate(el => el.className);
        expect(className).not.toContain('mu-disable-html-render');

        // Preview should contain a real .injected div in its parsed DOM.
        const preview = wrapper.locator(editor.htmlPreview);
        const injected = preview.locator('.injected');
        await expect(injected).toHaveCount(1);
    });

    /**
     * CHARACTERIZATION — inline raw-html is NOT gated by `disableHtml`.
     *
     * Source of truth: `disableHtml` is read in exactly three block-level
     * spots —
     *   - `packages/core/src/block/commonMark/html/index.ts` (pushes the
     *     `mu-disable-html-render` class onto the html-BLOCK wrapper),
     *   - `packages/core/src/block/commonMark/html/htmlPreview.ts` +
     *     `packages/core/src/utils/index.ts::sanitize` (escapes the
     *     html-BLOCK preview),
     *   - `packages/core/src/ui/previewToolBar/index.ts` (toolbar gating).
     *
     * The inline pipeline never consults it: neither
     * `packages/core/src/inlineRenderer/lexer.ts` nor
     * `packages/core/src/inlineRenderer/renderer/htmlTag.ts` reference
     * `disableHtml`. So an inline `<u>…</u>` / `<b>…</b>` token inside a
     * paragraph still renders as a LIVE element (a real `<u>`/`<b>` carrying
     * `.mu-inline-rule.mu-raw-html`) even when `disableHtml: true`.
     *
     * That contradicts the intuitive expectation that `disableHtml` would
     * also neutralize inline HTML — see `suspectedBugs`. These tests pin the
     * actual behavior so the gap is visible if it ever changes.
     */
    test('disableHtml: true — inline <u> raw-html STILL renders as a live element (not source)', async ({ page }) => {
        await page.evaluate(() => {
            window.__e2e!.rebuildMuya({ disableHtml: true });
            window.muya!.setContent([{
                name: 'paragraph',
                text: '<u>under</u>',
            }] as TState[]);
        });

        // No block-level disable class is applied — that flag is html-BLOCK
        // only, and this is a paragraph with an inline html_tag token.
        await expect(page.locator(editor.htmlDisabled)).toHaveCount(0);
        // The html-block wrapper is never created for inline html either.
        await expect(page.locator(editor.htmlBlock)).toHaveCount(0);

        // The inline raw-html renders as a live `<u>` element (NOT escaped
        // source). The `<u>` carries the `.mu-raw-html` inline marker class.
        const live = page.locator('u.mu-raw-html');
        await expect(live).toHaveCount(1);
        await expect(live).toBeVisible();
        // The visible content of the rendered element is just the inner text,
        // not the literal tag markup.
        await expect(live).toHaveText('under');

        // The original source is preserved on the element's `data-raw`
        // attribute (used for round-trip / caret editing).
        await expect(live).toHaveAttribute('data-raw', '<u>under</u>');

        // Round-trips losslessly back to the raw-html source.
        expect(await getMarkdown(page)).toBe('<u>under</u>\n');
    });

    test('disableHtml: true — inline <b> raw-html renders the same as with disableHtml: false', async ({ page }) => {
        await page.evaluate(() => {
            window.__e2e!.rebuildMuya({ disableHtml: true });
            window.muya!.setContent([{
                name: 'paragraph',
                text: '<b>strong</b>',
            }] as TState[]);
        });
        const liveEnabled = page.locator('b.mu-raw-html');
        await expect(liveEnabled).toHaveCount(1);
        await expect(liveEnabled).toHaveText('strong');
        const markdownEnabled = await getMarkdown(page);

        // disableHtml: false (default) — identical inline outcome, proving the
        // flag has no effect on inline html rendering.
        await page.evaluate(() => {
            window.__e2e!.rebuildMuya({ disableHtml: false });
            window.muya!.setContent([{
                name: 'paragraph',
                text: '<b>strong</b>',
            }] as TState[]);
        });
        const liveDefault = page.locator('b.mu-raw-html');
        await expect(liveDefault).toHaveCount(1);
        await expect(liveDefault).toHaveText('strong');
        const markdownDefault = await getMarkdown(page);

        expect(markdownEnabled).toBe(markdownDefault);
        expect(markdownDefault).toBe('<b>strong</b>\n');
    });
});
