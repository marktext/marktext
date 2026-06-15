import { Buffer } from 'node:buffer';
import { expect, test } from '../fixtures/muya';
import { editor } from '../helpers/selectors';

// A 1×1 transparent PNG; works for any browser's <img> loader.
const ONE_PIXEL_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    'base64',
);

/**
 * Reference-link / reference-image round-trip — defense-in-depth for PR-16.
 *
 * Reference definitions live as `paragraph` state nodes whose text is the raw
 * `[label]: url "title"` line. `InlineRenderer.collectReferenceDefinitions`
 * regex-scans paragraphs to build the labels Map, which the lexer consults
 * when expanding `[text][ref]` and `![alt][ref]`.
 *
 * Concrete things this spec defends against:
 *   - Reference link `[label][ref]` resolves the `href` from the labels Map.
 *   - Reference image `![alt][ref]` resolves a real `<img>` src.
 *   - Case-insensitive label matching (CommonMark normalizes case + whitespace).
 *   - getMarkdown round-trips the definition exactly (label + url + optional title).
 */

test.describe('reference link', () => {
    test('[label][ref] renders an anchor + round-trips the definition', async ({ page }) => {
        const source = 'See [label][ref] inline.\n\n[ref]: https://example.com "the title"\n';
        await page.evaluate((md) => {
            window.muya!.setContent(md);
        }, source);

        // Sync barrier — wait for the paragraph to render the link text.
        await expect(page.locator(editor.paragraph).first()).toContainText('label');

        // The reference link mounts as `a.mu-reference-link` with the
        // resolved href from the labels Map.
        const anchor = page.locator(editor.referenceLink).first();
        await expect(anchor).toBeVisible();
        await expect(anchor).toHaveAttribute('href', 'https://example.com');

        const md = await page.evaluate(() => window.muya!.getMarkdown());
        expect(md).toContain('[label][ref]');
        expect(md).toContain('[ref]: https://example.com "the title"');
    });

    test('reference link with case-mismatched label still resolves', async ({ page }) => {
        // CommonMark normalizes labels case-insensitively (and collapses
        // internal whitespace). `[LaBeL][REF]` should resolve against
        // `[ref]: …`.
        const source = 'See [text][REF] inline.\n\n[ref]: https://example.com\n';
        await page.evaluate((md) => {
            window.muya!.setContent(md);
        }, source);

        await expect(page.locator(editor.paragraph).first()).toContainText('text');

        const anchor = page.locator(editor.referenceLink).first();
        await expect(anchor).toBeVisible();
        await expect(anchor).toHaveAttribute('href', 'https://example.com');
    });

    test('editing the definition URL re-resolves the link href on re-render', async ({ page }) => {
        // `InlineRenderer.collectReferenceDefinitions()` rebuilds the labels
        // Map from the JSON state on every render pass, and `referenceLink.ts`
        // reads `parent.labels.get(key)` for the href. Replacing the document
        // with an updated definition therefore re-resolves `[a][r]` against the
        // new URL when the link block re-patches.
        await page.evaluate(() => {
            window.muya!.setContent('[a][r]\n\n[r]: http://example.com\n');
        });

        const anchor = page.locator(editor.referenceLink).first();
        await expect(anchor).toBeVisible();
        await expect(anchor).toHaveAttribute('href', 'http://example.com');

        // Swap only the definition's URL; the inline `[a][r]` text is unchanged.
        await page.evaluate(() => {
            window.muya!.setContent('[a][r]\n\n[r]: http://updated.example.org\n');
        });

        // After re-render the anchor mounts again and resolves the new href.
        const updated = page.locator(editor.referenceLink).first();
        await expect(updated).toBeVisible();
        await expect(updated).toHaveAttribute('href', 'http://updated.example.org');

        const md = await page.evaluate(() => window.muya!.getMarkdown());
        expect(md).toContain('[a][r]');
        expect(md).toContain('[r]: http://updated.example.org');
    });

    test('removing the definition leaves the reference unresolved (no anchor, literal text)', async ({ page }) => {
        // The lexer only emits a `reference_link` token when the label is
        // present in the labels Map (lexer.ts: `labels.has(...)` guard). With a
        // matching definition the reference resolves to `a.mu-reference-link`.
        // Dropping the definition means `[a][r]` is never tokenized as a
        // reference at all — it renders as literal text, no anchor, no
        // `span.mu-reference-link` either.
        await page.evaluate(() => {
            window.muya!.setContent('[a][r]\n\n[r]: http://example.com\n');
        });

        await expect(page.locator(editor.referenceLink).first()).toHaveAttribute(
            'href',
            'http://example.com',
        );

        await page.evaluate(() => {
            window.muya!.setContent('[a][r]\n');
        });

        // No reference-link element of any kind survives an unresolved label.
        await expect(page.locator('.mu-reference-link')).toHaveCount(0);
        // The raw text round-trips through getMarkdown unchanged.
        const md = await page.evaluate(() => window.muya!.getMarkdown());
        expect(md).toContain('[a][r]');
    });
});

test.describe('reference image', () => {
    test.beforeEach(async ({ page }) => {
        // The reference-image renderer only mounts an actual <img> once
        // `loadImage` resolves (see `loadImageAsync.ts`). `example.test` would
        // otherwise fail DNS resolution and never resolve. Serve a 1×1 PNG.
        await page.route('**/example.test/**', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'image/png',
                body: ONE_PIXEL_PNG,
            });
        });
    });

    test('![alt][ref] renders and round-trips the definition', async ({ page }) => {
        const source = '![alt text][img]\n\n[img]: https://example.test/img.png\n';
        await page.evaluate((md) => {
            window.muya!.setContent(md);
        }, source);

        // The reference image renders inside the paragraph; wait for the
        // rendered `<img>` to mount (image is async — see `loadImageAsync`).
        const img = page.locator(`${editor.paragraph} img`).first();
        await expect(img).toBeVisible({ timeout: 10_000 });
        await expect(img).toHaveAttribute('src', /example\.test\/img\.png/);

        const md = await page.evaluate(() => window.muya!.getMarkdown());
        expect(md).toContain('![alt text][img]');
        expect(md).toContain('[img]: https://example.test/img.png');
    });

    test('reference image with case-mismatched label still resolves', async ({ page }) => {
        const source = '![alt][IMG]\n\n[img]: https://example.test/case.png\n';
        await page.evaluate((md) => {
            window.muya!.setContent(md);
        }, source);

        const img = page.locator(`${editor.paragraph} img`).first();
        await expect(img).toBeVisible({ timeout: 10_000 });
        await expect(img).toHaveAttribute('src', /example\.test\/case\.png/);
    });
});
