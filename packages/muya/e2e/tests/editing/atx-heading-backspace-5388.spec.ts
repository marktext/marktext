import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { loadMarkdown } from '../helpers/keyboard';

// #5388: Backspace right before an ATX heading's text removed the space after
// `#` without re-reading the block type. The line showed `#Heading` as an H1,
// and the saved markdown kept `# Heading`.

async function nextFrames(page: Page): Promise<void> {
    await page.evaluate(() => new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }));
}

async function caretBeforeHeadingText(page: Page): Promise<void> {
    const end = await page.evaluate(() => {
        const rect = document.querySelector('.mu-atxheading-content')!.getBoundingClientRect();
        return { x: rect.right - 2, y: rect.top + rect.height / 2 };
    });
    await page.mouse.click(end.x, end.y);
    await nextFrames(page);
    await page.keyboard.press('End');
    for (let i = 0; i < 'Heading'.length; i++)
        await page.keyboard.press('ArrowLeft');
    await nextFrames(page);
}

const PRECEDING_BLOCKS = [
    { label: 'a paragraph', before: 'one' },
    { label: 'a bullet list', before: '- one\n- two' },
];

for (const { label, before } of PRECEDING_BLOCKS) {
    test(`Backspace before the text of an ATX heading below ${label} makes it a paragraph (#5388)`, async ({ page }) => {
        await loadMarkdown(page, `${before}\n\n# Heading\n`);
        await nextFrames(page);
        await caretBeforeHeadingText(page);

        await page.keyboard.press('Backspace');
        await nextFrames(page);

        await expect.poll(() => getMarkdown(page)).toBe(`${before}\n\n#Heading\n`);
        await expect(page.locator('.mu-container > h1')).toHaveCount(0);
        await expect(page.locator('.mu-container > p').last()).toHaveText('#Heading');

        await page.keyboard.type('X');
        await expect.poll(() => getMarkdown(page)).toBe(`${before}\n\n#XHeading\n`);
    });
}
