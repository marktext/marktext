import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { metaKey } from '../helpers/keyboard';
import { editor } from '../helpers/selectors';

async function tripleClickFirstParagraph(page: import('@playwright/test').Page) {
    await page.locator(editor.paragraph).first().click({ clickCount: 3 });
    // The keystroke races the selection: pressing the shortcut before the
    // triple-click selection settles formats nothing (the known flake in
    // this suite). Gate on a real, non-collapsed selection.
    await page.waitForFunction(() => {
        const selection = window.getSelection();
        return !!selection && !selection.isCollapsed && selection.toString().length > 0;
    });
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

    // The internal default follows the ADVERTISED binding (Cmd/Ctrl+`);
    // the legacy Cmd/Ctrl+E stopped applying when the two were unified (#4687).
    test('Cmd/Ctrl+` applies inline code', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent('codeblock'));
        await tripleClickFirstParagraph(page);
        await page.keyboard.press(`${metaKey()}+\``);
        expect(await getMarkdown(page)).toContain('`codeblock`');
    });

    test('Cmd/Ctrl+E no longer applies inline code', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent('codeblock'));
        await tripleClickFirstParagraph(page);
        await page.keyboard.press(`${metaKey()}+e`);
        expect(await getMarkdown(page)).not.toContain('`codeblock`');
    });

    // Shift-modified defaults arrive as an uppercase `event.key`; matching is
    // case-insensitive since #4687 (they could never fire before).
    test('Cmd/Ctrl+Shift+H applies highlight to the selection', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent('marked text'));
        await tripleClickFirstParagraph(page);
        await page.keyboard.press(`${metaKey()}+Shift+h`);
        expect(await getMarkdown(page)).toContain('<mark>marked text</mark>');
    });

    test('Cmd/Ctrl+D applies strikethrough to the selection', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent('struck text'));
        await tripleClickFirstParagraph(page);
        await page.keyboard.press(`${metaKey()}+d`);
        const del = page.locator(`${editor.paragraph} del`).first();
        await expect(del).toBeVisible();
        await expect(del).toContainText('struck text');
        expect(await getMarkdown(page)).toContain('~~struck text~~');
    });
});
