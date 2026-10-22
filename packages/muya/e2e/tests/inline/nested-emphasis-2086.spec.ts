import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { focusEditor, loadMarkdown, slowType } from '../helpers/keyboard';
import { editor } from '../helpers/selectors';

test.describe('nested emphasis delimiters (#2086)', () => {
    test('`*a *b* c*` renders an em inside an em', async ({ page }) => {
        await loadMarkdown(page, '*a *b* c*');

        const outer = page.locator(`${editor.paragraphContent} > em`);
        await expect(outer).toHaveCount(1);
        await expect(outer.locator('em')).toHaveText('b');
        await expect(outer.locator('.mu-plain-text').last()).toHaveText(' c');
        expect(await getMarkdown(page)).toContain('*a *b* c*');
    });

    test('`**a **b** c**` renders a strong inside a strong', async ({ page }) => {
        await loadMarkdown(page, '**a **b** c**');

        const outer = page.locator(`${editor.paragraphContent} > strong`);
        await expect(outer).toHaveCount(1);
        await expect(outer.locator('strong')).toHaveText('b');
        await expect(outer.locator('.mu-plain-text').last()).toHaveText(' c');
    });

    test('typing the closing delimiter completes both pairs', async ({ page }) => {
        await loadMarkdown(page, '');
        await focusEditor(page);
        await slowType(page, '*a *b* c*');

        const outer = page.locator(`${editor.paragraphContent} > em`);
        await expect(outer).toHaveCount(1);
        await expect(outer.locator('em')).toHaveText('b');
        expect(await getMarkdown(page)).toContain('*a *b* c*');
    });
});
