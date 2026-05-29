import { expect, test } from '../fixtures/muya';
import { editor, floats } from '../helpers/selectors';

test.describe('footnote tool', () => {
    test('footnote-tool float root is registered (option footnote: true)', async ({ page }) => {
        // host/main.ts wires `footnote: true`; the FootnoteTool plugin should
        // mount its baseFloat container at init.
        await expect(page.locator(floats.footnoteTool)).toHaveCount(1);
    });

    test('setContent with a footnote definition renders inline identifier', async ({ page }) => {
        await page.evaluate(() => {
            window.muya!.setContent('Some text[^a].\n\n[^a]: footnote body\n');
        });
        // The footnote identifier renders as `.mu-inline-footnote-identifier`.
        await expect(page.locator(editor.inlineFootnoteIdentifier).first()).toBeVisible();
    });
});
