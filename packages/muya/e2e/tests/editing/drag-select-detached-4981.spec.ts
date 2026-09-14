import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { editor } from '../helpers/selectors';

async function paragraphPoint(page: Page, index: number, edge: 'start' | 'end'): Promise<{ x: number; y: number }> {
    const box = await page.locator(editor.paragraph).nth(index).boundingBox();
    if (!box)
        throw new Error(`paragraph ${index} has no bounding box`);
    return {
        x: edge === 'start' ? box.x + 1 : box.x + box.width - 2,
        y: box.y + box.height / 2,
    };
}

interface IScenario {
    name: string;
    from: [number, 'start' | 'end'];
    to: [number, 'start' | 'end'];
    whileDragging: (page: Page) => Promise<void>;
}

const scenarios: IScenario[] = [
    {
        name: 'Backspace over bbb..ccc (backward)',
        from: [2, 'end'],
        to: [1, 'start'],
        whileDragging: page => page.keyboard.press('Backspace'),
    },
    {
        name: 'Backspace over bbb..ccc (forward)',
        from: [1, 'start'],
        to: [2, 'end'],
        whileDragging: page => page.keyboard.press('Backspace'),
    },
];

for (const scenario of scenarios) {
    test(`#4981 releasing a cross-block drag after ${scenario.name} does not crash`, async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', err => errors.push(String(err?.message ?? err)));

        await page.evaluate(() => window.muya!.setContent('aaa\n\nbbb\n\nccc\n'));
        await expect(page.locator(editor.paragraph)).toHaveCount(3);

        const from = await paragraphPoint(page, ...scenario.from);
        const to = await paragraphPoint(page, ...scenario.to);

        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        await page.mouse.move(to.x, to.y, { steps: 8 });
        await scenario.whileDragging(page);
        await page.waitForTimeout(200);
        await page.mouse.up();
        await page.waitForTimeout(300);

        expect(errors, `renderer pageerrors: ${errors.join(' | ')}`).toEqual([]);
    });
}
