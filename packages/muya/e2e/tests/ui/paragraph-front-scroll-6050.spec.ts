import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { editor, floats } from '../helpers/selectors';

async function prepareDocument(page: Page, nested: boolean): Promise<void> {
    await page.evaluate(({ nested }) => {
        const container = window.muya!.domNode.parentElement!;
        container.style.padding = '16px 100px';
        if (nested) {
            container.style.height = '500px';
            container.style.overflow = 'auto';
        }
        window.muya!.setContent(Array.from({ length: 100 }, (_, i) => `Paragraph ${i + 1}`).join('\n\n'));
        window.muya!.flush();
    }, { nested });
    await page.locator(editor.paragraph).first().hover();
    await expect(page.locator(floats.paragraphFrontButton)).toHaveCSS('opacity', '1');
}

for (const nested of [true, false]) {
    test(`scrolling the ${nested ? 'editor ancestor' : 'document'} hides the block button until the next mouse move`, async ({ page }) => {
        await prepareDocument(page, nested);
        const button = page.locator(floats.paragraphFrontButton);
        await page.mouse.wheel(0, 100);
        await expect(button).toHaveCSS('opacity', '0');
        const hiddenStyle = await button.getAttribute('style');

        for (let i = 0; i < 5; i++) {
            await page.mouse.wheel(0, 100);
            await page.waitForTimeout(60);
        }
        await expect(button).toHaveAttribute('style', hiddenStyle!);

        const scrollTop = await page.evaluate((nested) => {
            const scroller = nested ? window.muya!.domNode.parentElement! : document.scrollingElement!;
            return scroller.scrollTop;
        }, nested);
        expect(scrollTop).toBeGreaterThan(100);

        await page.locator(editor.paragraph).nth(20).hover();
        await expect(button).toHaveCSS('opacity', '1');
        await page.locator(floats.paragraphFrontButtonInner).click();
        await expect(page.locator(`${floats.paragraphFrontMenu} .turn-into-item`).first()).toBeVisible();
    });
}

test('a mouse move queued before scrolling cannot show the block button again', async ({ page }) => {
    await prepareDocument(page, true);
    await page.evaluate((selector) => {
        const paragraph = document.querySelector<HTMLElement>(selector)!;
        const rect = paragraph.getBoundingClientRect();
        const move = () => paragraph.dispatchEvent(new MouseEvent('mousemove', {
            bubbles: true,
            clientX: rect.x + 10,
            clientY: rect.y + rect.height / 2,
        }));
        move();
        move();
        window.muya!.domNode.parentElement!.scrollTop = 100;
    }, editor.paragraph);
    await page.waitForTimeout(600);
    await expect(page.locator(floats.paragraphFrontButton)).toHaveCSS('opacity', '0');
});

test('scrolling an unrelated element keeps the block button available', async ({ page }) => {
    await prepareDocument(page, true);
    await page.evaluate(() => {
        const unrelated = document.createElement('div');
        unrelated.style.cssText = 'position: fixed; right: 0; top: 0; height: 50px; overflow: auto';
        const content = document.createElement('div');
        content.style.height = '500px';
        unrelated.appendChild(content);
        document.body.appendChild(unrelated);
        unrelated.scrollTop = 100;
    });
    await page.waitForTimeout(350);
    await expect(page.locator(floats.paragraphFrontButton)).toHaveCSS('opacity', '1');
});
