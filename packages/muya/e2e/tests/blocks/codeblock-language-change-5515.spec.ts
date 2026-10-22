import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { editor } from '../helpers/selectors';

// #5515 — clearing a code block's language, or naming one Prism does not have,
// left the block rendered with the previous grammar's markup. Both are cases
// where nothing loads, and the `lang` setter only re-rendered on a successful
// load. In a real browser Prism resolves asynchronously, which the unit spec's
// preloaded grammars do not exercise.

const TOKEN = `${editor.codeContent} span.token`;

/**
 * Replace the language through the language input's own entry point — the same
 * `_updateLanguage` its DOM input handler calls on every keystroke.
 */
async function setLanguage(page: Page, next: string): Promise<void> {
    await page.evaluate((value) => {
        const find = (block: {
            constructor: { blockName?: string };
            children?: { forEach: (cb: (b: unknown) => void) => void };
        }): unknown => {
            let hit: unknown = null;
            const visit = (b: typeof block) => {
                if (b.constructor.blockName === 'language-input')
                    hit ??= b;
                b.children?.forEach(c => visit(c as typeof block));
            };
            visit(block);
            return hit;
        };
        const input = find(
            window.muya!.editor.scrollPage as unknown as Parameters<typeof find>[0],
        ) as {
            text: string;
            setCursor: (start: number, end: number) => void;
            updateLanguage: (lang: string) => void;
        };
        input.setCursor(input.text.length, input.text.length);
        input.updateLanguage(value);
    }, next);
}

async function openHighlightedJsBlock(page: Page): Promise<void> {
    await page.evaluate(() => window.muya!.setContent('```js\nconst x = 1\n```\n'));
    await expect(page.locator(editor.codeBlock).first()).toBeVisible();
    // Prism resolves the grammar asynchronously on the first render.
    await expect.poll(() => page.locator(TOKEN).count()).toBeGreaterThan(0);
}

test.describe('code block language change (#5515)', () => {
    test('clearing the language drops the highlighting', async ({ page }) => {
        await openHighlightedJsBlock(page);

        await setLanguage(page, '');

        await expect.poll(() => page.locator(TOKEN).count()).toBe(0);
        await expect.poll(() => getMarkdown(page)).toBe('```\nconst x = 1\n```\n');
    });

    test('an unknown language drops the highlighting', async ({ page }) => {
        await openHighlightedJsBlock(page);

        await setLanguage(page, 'notalanguage');

        await expect.poll(() => page.locator(TOKEN).count()).toBe(0);
        await expect.poll(() => getMarkdown(page)).toBe('```notalanguage\nconst x = 1\n```\n');
    });

    test('another known language still re-highlights', async ({ page }) => {
        await openHighlightedJsBlock(page);
        const asJs = await page.locator(TOKEN).count();

        await setLanguage(page, 'python');

        // `const` is not a python keyword, so the token run changes.
        await expect.poll(() => page.locator(TOKEN).count()).not.toBe(asJs);
        await expect.poll(() => page.locator(TOKEN).count()).toBeGreaterThan(0);
        await expect.poll(() => getMarkdown(page)).toBe('```python\nconst x = 1\n```\n');
    });
});
