import { expect, test } from '@playwright/test';
import { loadMarkdown, slowType } from '../helpers/keyboard';
import { editor } from '../helpers/selectors';

// #3191: typing near the end of a long, horizontally-scrolled line in a code
// block reset the scroll back to the start of the line, because every
// keystroke rewrites the content `innerHTML` (which resets the scroll
// container's scrollLeft). The fix preserves and restores the scroll position
// across the re-render. This is a real-browser layout behaviour, so it can
// only be verified end-to-end.

const LONG_LINE = `const x = "${'a'.repeat(400)}";`;

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loadMarkdown(page, `\`\`\`js\n${LONG_LINE}\n\`\`\`\n`);
});

test('continuing to type at the end of a long line keeps the caret in view', async ({ page }) => {
    const codeContent = page.locator(editor.codeContent).first();
    await codeContent.click();

    // The `.mu-code` element is the horizontal overflow container.
    const scroller = page.locator(editor.codeBlock).locator('.mu-code').first();

    // Go to the end of the line (the issue's step 2).
    await page.keyboard.press('End');

    const maxScroll = await scroller.evaluate((el) => {
        el.scrollLeft = el.scrollWidth;
        return el.scrollLeft;
    });
    expect(maxScroll, 'the line should overflow horizontally').toBeGreaterThan(100);

    // Step 3: keep typing characters. After each keystroke the scroll must
    // stay near the caret (the end), not jump back to the start.
    for (const ch of ['1', '2', '3', '4', '5']) {
        await slowType(page, ch);
        const scrollLeft = await scroller.evaluate(el => el.scrollLeft);
        expect(scrollLeft, `scroll reset to start after typing "${ch}"`).toBeGreaterThan(maxScroll - 60);
    }

    // The typed characters landed at the end of the line.
    const text = await codeContent.evaluate(el => el.textContent ?? '');
    expect(text.endsWith('12345')).toBe(true);
});
