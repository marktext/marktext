import type { TState } from '@muyajs/core';
import { expect, test } from '../fixtures/muya';
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
});
