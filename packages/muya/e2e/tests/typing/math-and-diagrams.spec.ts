import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { editor } from '../helpers/selectors';

test.describe('math and diagrams', () => {
    test('typing $$ + Enter converts paragraph to a math block', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent(''));
        await page.locator(editor.paragraph).first().click();
        await page.keyboard.type('$$');
        await page.keyboard.press('Enter');
        await expect(page.locator(editor.mathBlock).first()).toBeVisible();
    });

    test('math block renders KaTeX after typing a formula', async ({ page }) => {
        await page.evaluate(() => {
            window.muya!.setContent([{
                name: 'math-block',
                text: 'a \\ne b',
                meta: { mathStyle: '' },
            }] as unknown as Parameters<NonNullable<typeof window.muya>['setContent']>[0]);
        });
        // KaTeX renders asynchronously into .mu-math-render; wait for it.
        await expect(page.locator(editor.katex).first()).toBeVisible({ timeout: 10_000 });
        expect(await getMarkdown(page)).toContain('a \\ne b');
    });

    test('mermaid diagram block renders SVG', async ({ page }) => {
        await page.evaluate(() => {
            window.muya!.setContent([{
                name: 'diagram',
                text: 'graph TD\n    A-->B',
                meta: { lang: 'yaml', type: 'mermaid' },
            }] as unknown as Parameters<NonNullable<typeof window.muya>['setContent']>[0]);
        });
        // Mermaid is async; allow up to 15s for the SVG to mount inside the
        // diagram preview.
        await expect(page.locator(`${editor.diagramPreview} svg`).first())
            .toBeVisible({ timeout: 15_000 });
    });
});
