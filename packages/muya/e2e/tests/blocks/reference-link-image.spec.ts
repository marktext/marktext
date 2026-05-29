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
