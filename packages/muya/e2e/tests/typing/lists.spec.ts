import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { slowType } from '../helpers/keyboard';
import { editor, floats, quickInsertItem } from '../helpers/selectors';

async function emptyParagraph(page: import('@playwright/test').Page) {
    await page.evaluate(() => window.muya!.setContent(''));
    await page.locator(editor.paragraph).first().click();
}

test.describe('lists', () => {
    test('slash menu creates a bullet list', async ({ page }) => {
        await emptyParagraph(page);
        await page.keyboard.type('/');
        await expect(page.locator(floats.quickInsert)).toBeVisible();
        await page.locator(quickInsertItem('bullet-list')).click();
        await expect(page.locator(editor.bulletList).first()).toBeVisible();
    });

    test('slash menu creates an ordered list', async ({ page }) => {
        await emptyParagraph(page);
        await page.keyboard.type('/');
        await page.locator(quickInsertItem('order-list')).click();
        await expect(page.locator(editor.orderList).first()).toBeVisible();
    });

    test('slash menu creates a task list', async ({ page }) => {
        await emptyParagraph(page);
        await page.keyboard.type('/');
        await page.locator(quickInsertItem('task-list')).click();
        await expect(page.locator(editor.taskList).first()).toBeVisible();
        await expect(page.locator(editor.taskListItem).first()).toBeVisible();
    });

    test('typing inside a bullet list reflects in getMarkdown', async ({ page }) => {
        await emptyParagraph(page);
        await page.keyboard.type('/');
        await page.locator(quickInsertItem('bullet-list')).click();
        const bullet = page.locator(editor.bulletList).first();
        await expect(bullet).toBeVisible();
        // Click into the first list item's paragraph to force a deterministic
        // cursor position before typing. The slash-menu close + auto-focus is
        // async and racy.
        await bullet.locator(editor.paragraph).first().click();
        await slowType(page, 'first item');
        await page.keyboard.press('Enter');
        // Enter creates a new <li> — wait for the second paragraph node to
        // mount before typing into it.
        await expect(bullet.locator(editor.paragraph)).toHaveCount(2);
        await slowType(page, 'second item');
        // Wait for the DOM to reflect the final character before reading
        // markdown — getMarkdown reads state which the input pipeline updates
        // asynchronously, so use the rendered text as the sync barrier.
        await expect(bullet.locator(editor.paragraph).nth(1)).toContainText('second item');
        const md = await getMarkdown(page);
        expect(md).toContain('first item');
        expect(md).toContain('second item');
    });
});
