import { expect, test } from '../fixtures/muya';
import { getMarkdown, getTOC } from '../helpers/api';

test.describe('public api', () => {
    test('setContent then getMarkdown round-trips', async ({ page }) => {
        await page.evaluate(() => {
            window.muya!.setContent('# Title\n\nHello world\n');
        });
        const md = await getMarkdown(page);
        expect(md).toContain('# Title');
        expect(md).toContain('Hello world');
    });

    test('getTOC reflects headings in the document', async ({ page }) => {
        await page.evaluate(() => {
            window.muya!.setContent('# H1\n\n## H2\n\n### H3\n\ntext\n');
        });
        const toc = await getTOC(page);
        expect(toc.length).toBe(3);
        expect(toc.map(item => ({ lvl: item.lvl, content: item.content }))).toEqual([
            { lvl: 1, content: 'H1' },
            { lvl: 2, content: 'H2' },
            { lvl: 3, content: 'H3' },
        ]);
        expect(toc[0].slug).toBeTruthy();
        expect(toc[0].githubSlug).toBe('h1');
    });

    test('locale switch flips muya.i18n.lang', async ({ page }) => {
        const before = await page.evaluate(() => window.muya!.i18n.lang);
        expect(before).toBe('en');
        await page.locator('#language-select').selectOption('zh-CN');
        const after = await page.evaluate(() => window.muya!.i18n.lang);
        expect(after).toBe('zh-CN');
    });
});
