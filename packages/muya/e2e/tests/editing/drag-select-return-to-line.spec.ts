import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';

const MARKDOWN = '- alpha one two three\n- bravo two words here\n- charlie four five six\n';

async function lineGeometry(page: Page) {
    return page.locator('.mu-container li .mu-content').nth(1).evaluate((element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        const rect = range.getBoundingClientRect();
        return { left: rect.left, right: rect.right, y: rect.top + rect.height / 2, height: rect.height };
    });
}

// With a single return move, Chromium has not yet updated the native selection
// when the mousemove handler runs, so only the release can see the final range.
for (const returnSteps of [6, 1]) {
    for (const direction of [1, -1]) {
        test(`a drag that strays ${direction > 0 ? 'below' : 'above'} its line and returns in ${returnSteps} move(s) keeps the line selection on release`, async ({ page }) => {
            await page.evaluate(markdown => window.muya!.setContent(markdown), MARKDOWN);
            const line = await lineGeometry(page);

            await page.mouse.move(line.left + 1, line.y);
            await page.mouse.down();
            await page.mouse.move(line.right - 1, line.y, { steps: 10 });
            await page.mouse.move(line.right - 30, line.y + direction * line.height * 1.5, { steps: 6 });
            await page.mouse.move(line.right - 1, line.y, { steps: returnSteps });
            await expect.poll(() => page.evaluate(() => getSelection()!.toString())).toBe('bravo two words here');
            await page.mouse.up();

            await expect.poll(() => page.evaluate(() => getSelection()!.toString())).toBe('bravo two words here');
        });
    }
}
