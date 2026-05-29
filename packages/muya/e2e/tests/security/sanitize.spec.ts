import type { TState } from '@muyajs/core';
import { expect, test } from '../fixtures/muya';
import { editor } from '../helpers/selectors';

/**
 * Sanitization / XSS guardrails for the `setContent` → DOM render path.
 *
 * Muya routes HTML blocks through DOMPurify (`utils/dompurify.ts`,
 * `PREVIEW_DOMPURIFY_CONFIG`). Inline `<a href>` URLs go through
 * `sanitizeHyperlink`. We assert three canonical XSS shapes are neutralized:
 *   - `<script>` payload never executes (window.__pwned stays undefined).
 *   - `javascript:` hrefs are stripped or replaced.
 *   - `onerror=` attributes are dropped.
 *
 * Static-export sanitization (`new MarkdownToHtml(md).generate()`) is a
 * Phase 4 item — this spec only covers the live editor render path.
 */

test.describe('sanitize XSS payloads', () => {
    test.beforeEach(async ({ page }) => {
        // Reset the canary before each test. The fixture loads a fresh page,
        // but be explicit so a stale flag from a different spec can't leak.
        await page.evaluate(() => {
            (window as Window & { __pwned?: boolean }).__pwned = undefined;
        });
    });

    test('<script> in an html-block does not execute', async ({ page }) => {
        const payload = '<script>(window).__pwned = true;</script>';
        await page.evaluate((text) => {
            const state: TState[] = [{ name: 'html-block', text }];
            window.muya!.setContent(state);
        }, payload);

        // Sync barrier: html-block mounts an `.mu-html-block` and (eventually)
        // an `.mu-html-preview` child. The script should never run.
        await expect(page.locator(editor.htmlBlock).first()).toBeVisible();

        // Give the event loop a tick — DOMPurify strips inert nodes, but
        // we want to be sure nothing async fires later.
        await page.waitForTimeout(100);

        const pwned = await page.evaluate(() => (window as Window & { __pwned?: boolean }).__pwned);
        expect(pwned).toBeUndefined();
    });

    test('<a href="javascript:..."> has its href sanitized', async ({ page }) => {
        const payload = '<a href="javascript:alert(1)" id="xss-anchor">x</a>';
        await page.evaluate((text) => {
            const state: TState[] = [{ name: 'html-block', text }];
            window.muya!.setContent(state);
        }, payload);

        await expect(page.locator(editor.htmlBlock).first()).toBeVisible();

        // Read the rendered anchor's href out of the preview DOM. Two
        // acceptable outcomes:
        //   - DOMPurify removes the href attribute entirely.
        //   - DOMPurify rewrites it to `about:blank` (some configurations).
        // Either way, the navigable javascript: URI must not survive.
        const href = await page.evaluate(() => {
            const preview = document.querySelector('.mu-html-preview');
            const anchor = preview?.querySelector('a#xss-anchor');
            return anchor?.getAttribute('href') ?? null;
        });
        // If the attribute is missing the value will be null. If it's been
        // rewritten it must not contain `javascript:`.
        if (href !== null)
            expect(href.toLowerCase()).not.toContain('javascript:');
    });

    test('<img onerror="..."> drops the onerror attribute', async ({ page }) => {
        // Use a fake `src` that will 404 — if the `onerror` survives sanitization
        // it'd fire and set the canary.
        const payload = '<img src="x" onerror="(window).__pwned = true" id="xss-img">';
        await page.evaluate((text) => {
            const state: TState[] = [{ name: 'html-block', text }];
            window.muya!.setContent(state);
        }, payload);

        await expect(page.locator(editor.htmlBlock).first()).toBeVisible();

        // Wait long enough for the broken-image error to fire if it can.
        await page.waitForTimeout(200);

        const pwned = await page.evaluate(() => (window as Window & { __pwned?: boolean }).__pwned);
        expect(pwned).toBeUndefined();

        const onerrorAttr = await page.evaluate(() => {
            const preview = document.querySelector('.mu-html-preview');
            const img = preview?.querySelector('img#xss-img');
            return img?.getAttribute('onerror');
        });
        expect(onerrorAttr).toBeFalsy();
    });
});
