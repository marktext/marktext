import { expect, test } from '../fixtures/muya';
import { editor } from '../helpers/selectors';

/**
 * Footnote scenarios beyond the bare `setContent` smoke test in
 * `tests/ui/footnote.spec.ts`. Covers:
 *   - Multiple references to one definition.
 *   - Definition appearing before vs after first reference.
 *   - Orphan-definition behavior when the inline reference is deleted —
 *     current contract: definitions are *not* auto-cleaned up.
 */

test.describe('footnote scenarios', () => {
    test('multiple references to the same definition all render identifiers', async ({ page }) => {
        const source = 'A[^a] then B[^a] then C[^a].\n\n[^a]: shared body\n';
        await page.evaluate((md) => {
            window.muya!.setContent(md);
        }, source);

        await expect(page.locator(editor.paragraph).first()).toContainText('A');

        // All three inline footnote identifiers should mount.
        const identifiers = page.locator(editor.inlineFootnoteIdentifier);
        await expect(identifiers).toHaveCount(3);

        const md = await page.evaluate(() => window.muya!.getMarkdown());
        // Reference shape is `[^a]` × 3.
        expect((md.match(/\[\^a\](?!:)/g) ?? []).length).toBe(3);
        expect(md).toContain('[^a]: shared body');
    });

    test('definition appearing BEFORE the first reference still resolves', async ({ page }) => {
        // Spec says definitions can appear anywhere; renderer should still
        // recognize the inline `[^a]` token regardless of doc order.
        const source = '[^a]: defined first\n\nLater paragraph with[^a] a reference.\n';
        await page.evaluate((md) => {
            window.muya!.setContent(md);
        }, source);

        // Sync barrier: the editor root should contain both texts. The
        // first `.mu-paragraph` belongs to the footnote definition body so
        // we anchor on the editor root instead.
        await expect(page.locator(editor.root)).toContainText('Later paragraph');

        await expect(page.locator(editor.inlineFootnoteIdentifier).first()).toBeVisible();

        const md = await page.evaluate(() => window.muya!.getMarkdown());
        expect(md).toContain('[^a]: defined first');
        expect(md).toContain('[^a]');
    });

    test('deleting an inline [^a] token leaves the definition in state (no auto-cleanup)', async ({ page }) => {
        const source = 'Body[^a] text.\n\n[^a]: orphan body\n';
        await page.evaluate((md) => {
            window.muya!.setContent(md);
        }, source);

        await expect(page.locator(editor.inlineFootnoteIdentifier).first()).toBeVisible();

        // Wipe out the inline reference by reloading the paragraph without
        // the `[^a]` token. The definition block is untouched.
        await page.evaluate(() => {
            window.muya!.setContent('Body text.\n\n[^a]: orphan body\n');
        });

        await expect(page.locator(editor.paragraph).first()).toContainText('Body text');
        // No inline identifier any more.
        await expect(page.locator(editor.inlineFootnoteIdentifier)).toHaveCount(0);

        // Definition survives — verifying that orphan defs aren't auto-pruned.
        const md = await page.evaluate(() => window.muya!.getMarkdown());
        expect(md).toContain('[^a]: orphan body');
        // No `[^a]` reference in the body (only the definition prefix).
        expect((md.match(/\[\^a\](?!:)/g) ?? []).length).toBe(0);
    });
});
