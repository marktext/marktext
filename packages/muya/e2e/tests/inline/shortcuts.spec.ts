import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { metaKey } from '../helpers/keyboard';
import { editor } from '../helpers/selectors';

async function tripleClickFirstParagraph(page: import('@playwright/test').Page) {
    await page.locator(editor.paragraph).first().click({ clickCount: 3 });
}

test.describe('keyboard shortcuts', () => {
    test('Cmd/Ctrl+B applies strong to the selection', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent('shortcut bold'));
        await tripleClickFirstParagraph(page);
        await page.keyboard.press(`${metaKey()}+b`);
        expect(await getMarkdown(page)).toContain('**shortcut bold**');
    });

    test('Cmd/Ctrl+I applies emphasis to the selection', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent('emph text'));
        await tripleClickFirstParagraph(page);
        await page.keyboard.press(`${metaKey()}+i`);
        expect(await getMarkdown(page)).toMatch(/[*_]emph text[*_]/);
    });

    test('Cmd/Ctrl+E applies inline code', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent('codeblock'));
        await tripleClickFirstParagraph(page);
        await page.keyboard.press(`${metaKey()}+e`);
        expect(await getMarkdown(page)).toContain('`codeblock`');
    });

    test('Cmd/Ctrl+D applies strikethrough to the selection', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent('struck text'));
        await tripleClickFirstParagraph(page);
        await page.keyboard.press(`${metaKey()}+d`);
        // The `del` renderer mounts a live `<del>` element inside the paragraph.
        const del = page.locator(`${editor.paragraph} del`).first();
        await expect(del).toBeVisible();
        await expect(del).toContainText('struck text');
        expect(await getMarkdown(page)).toContain('~~struck text~~');
    });
});
