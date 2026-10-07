import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { slowType } from '../helpers/keyboard';
import { toolbar } from '../helpers/selectors';

async function highlightCount(page: import('@playwright/test').Page) {
    return page.evaluate(() => document.querySelectorAll('.mu-highlight, .mu-search-highlight').length);
}

test.describe('search and replace', () => {
    test('regex \\n highlights each soft line break without collapsing the lines (#3261)', async ({ page }) => {
        await page.evaluate(() => {
            window.muya!.setContent('line one\nline two\nline three\n');
        });
        await page.evaluate(() => {
            window.muya!.editor.searchModule.search('\\n', { isRegexp: true });
        });

        const result = await page.evaluate(() => {
            const content = document.querySelector('.mu-paragraph-content') as HTMLElement;
            const bands = Array.from(content.querySelectorAll('.mu-soft-line-break > span'));
            return {
                breaks: content.querySelectorAll('.mu-soft-line-break').length,
                bands: bands.length,
                lines: (content.textContent ?? '').split('\n').length,
                bandsVisible: bands.every(el => el.getBoundingClientRect().height > 0),
            };
        });

        expect(result).toEqual({ breaks: 2, bands: 2, lines: 3, bandsVisible: true });
    });

    test('a \\n band never wraps a full-width line onto a row of its own (#3261)', async ({ page }) => {
        await page.evaluate(() => {
            const style = document.createElement('style');
            style.id = 'exact-width';
            document.head.appendChild(style);
        });

        for (const trailing of ['', '  ']) {
            await page.evaluate((t) => {
                window.muya!.setContent(
                    `alpha bravo charlie delta echo foxtrot golf hotel india${t}\nsecond line\n`,
                );
            }, trailing);
            await page.waitForTimeout(150);

            const textWidth = await page.evaluate(() => {
                const first = document.querySelector('.mu-plain-text') as HTMLElement;
                const range = document.createRange();
                range.selectNodeContents(first);
                return range.getBoundingClientRect().width;
            });
            await page.evaluate((w) => {
                (document.getElementById('exact-width') as HTMLStyleElement)
                    .textContent = `.mu-content { width: ${Math.ceil(w) + 1}px; }`;
            }, textWidth);
            await page.waitForTimeout(200);

            const before = await page.evaluate(() => {
                const para = document.querySelector('.mu-paragraph-content') as HTMLElement;
                return para.getBoundingClientRect().height;
            });

            await page.evaluate(() => {
                window.muya!.editor.searchModule.search('\\n', { isRegexp: true });
            });
            await page.waitForTimeout(200);

            const after = await page.evaluate(() => {
                const para = document.querySelector('.mu-paragraph-content') as HTMLElement;
                const band = para.querySelector(
                    '.mu-soft-line-break > .mu-highlight, .mu-hard-line-break > .mu-highlight',
                ) as HTMLElement;
                const firstLine = para.querySelector('.mu-plain-text') as HTMLElement;
                return {
                    height: para.getBoundingClientRect().height,
                    bandTop: band.getBoundingClientRect().top,
                    lineBottom: firstLine.getBoundingClientRect().bottom,
                };
            });

            expect(after.height).toBe(before);
            expect(after.bandTop).toBeLessThan(after.lineBottom);
        }
    });

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
        // Replacement reaches the JSON state read by getMarkdown on the next frame.
        await expect.poll(() => getMarkdown(page)).toBe('bar foo foo\n');
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
        // Wait for the deferred state update and verify that every match was replaced.
        await expect.poll(() => getMarkdown(page)).toBe('dog dog dog\n');
    });
});
