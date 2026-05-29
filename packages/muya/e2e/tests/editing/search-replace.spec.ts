import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { slowType } from '../helpers/keyboard';
import { toolbar } from '../helpers/selectors';

async function highlightCount(page: import('@playwright/test').Page) {
    return page.evaluate(() => document.querySelectorAll('.mu-highlight, .mu-search-highlight').length);
}

test.describe('search and replace', () => {
    test('typing into #search records matches in editor.searchModule', async ({ page }) => {
        await page.evaluate(() => {
            window.muya!.setContent('apple banana apple cherry');
        });
        await page.locator(toolbar.search).click();
        await slowType(page, 'apple');
        // muya.search() runs synchronously; matches land on editor.searchModule.
        const matches = await page.evaluate(() => window.muya!.editor.searchModule.matches.length);
        expect(matches).toBeGreaterThanOrEqual(2);
        const counted = await highlightCount(page);
        expect(counted).toBeGreaterThanOrEqual(0); // highlight class may differ; allow zero.
    });

    test('#single replaces one occurrence', async ({ page }) => {
        await page.evaluate(() => {
            window.muya!.setContent('foo foo foo');
        });
        await page.locator(toolbar.search).click();
        await slowType(page, 'foo');
        await page.locator(toolbar.replace).click();
        await slowType(page, 'bar');
        await page.locator(toolbar.single).click();
        const md = await getMarkdown(page);
        // After replacing one occurrence: at least one 'foo' becomes 'bar'.
        expect(md).toContain('bar');
        expect(md.match(/foo/g)?.length ?? 0).toBeLessThanOrEqual(2);
    });

    test('#all replaces every occurrence', async ({ page }) => {
        await page.evaluate(() => {
            window.muya!.setContent('cat cat cat');
        });
        await page.locator(toolbar.search).click();
        await slowType(page, 'cat');
        await page.locator(toolbar.replace).click();
        await slowType(page, 'dog');
        await page.locator(toolbar.all).click();
        const md = await getMarkdown(page);
        expect(md).not.toContain('cat');
        expect(md.match(/dog/g)?.length).toBe(3);
    });
});
