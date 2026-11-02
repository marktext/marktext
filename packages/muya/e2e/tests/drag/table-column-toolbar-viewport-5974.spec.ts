import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { editor, floats } from '../helpers/selectors';

const TABLE = '| first | second | third |\n| --- | --- | --- |\n| alpha | bravo | charlie |\n';

function toolbarOpacity(page: Page): Promise<number> {
    return page.locator(floats.tableColumnTools).evaluate(el =>
        Number((el.parentElement as HTMLElement).style.opacity || 0),
    );
}

for (const scrollOwner of ['editor', 'ancestor'] as const) {
    test.describe(`#5974 column toolbar in a scrolling ${scrollOwner}`, () => {
        test.beforeEach(async ({ page }) => {
            await page.evaluate(({ markdown, scrollOwner }) => {
                const muya = window.muya!;
                muya.setContent(`${markdown}\n${'Following paragraph.\n\n'.repeat(20)}`);
                muya.flush();
                const viewport = scrollOwner === 'editor' ? muya.domNode : muya.domNode.parentElement!;
                Object.assign(viewport.style, {
                    height: '300px',
                    minHeight: '0',
                    width: '640px',
                    overflow: 'auto',
                });
                viewport.dataset.testViewport = '';
                const cell = muya.domNode.querySelector('td')!;
                viewport.scrollTop += cell.getBoundingClientRect().top - viewport.getBoundingClientRect().top - 7;
            }, { markdown: TABLE, scrollOwner });
        });

        test('keeps the toolbar inside the viewport and its column actions reachable', async ({ page }) => {
            const viewport = page.locator('[data-test-viewport]');
            const viewportBox = (await viewport.boundingBox())!;
            const cell = page.locator(editor.tableCell).first();
            const cellBox = (await cell.boundingBox())!;
            await page.mouse.move(cellBox.x + cellBox.width / 2, cellBox.y - 3);
            await expect.poll(() => toolbarOpacity(page)).toBe(1);

            const toolbar = page.locator(floats.tableColumnTools);
            const toolbarBox = (await toolbar.boundingBox())!;
            expect(toolbarBox.y).toBeGreaterThanOrEqual(viewportBox.y);
            expect(toolbarBox.y + toolbarBox.height).toBeLessThanOrEqual(viewportBox.y + viewportBox.height);
            await page.setViewportSize({ width: 800, height: 600 });
            await expect.poll(async () => {
                const bounds = (await viewport.boundingBox())!;
                const tools = (await toolbar.boundingBox())!;
                return tools.y >= bounds.y && tools.y + tools.height <= bounds.y + bounds.height;
            }).toBe(true);
            await toolbar.locator('li.item.center').click();
            await expect.poll(() => cell.getAttribute('data-align')).toBe('center');

            await viewport.evaluate(el => (el as HTMLElement).scrollTop += 50);
            await expect.poll(() => toolbarOpacity(page)).toBe(0);
        });

        test('does not trigger over host controls above the viewport', async ({ page }) => {
            const before = await getMarkdown(page);
            const cellBox = (await page.locator(editor.tableCell).first().boundingBox())!;
            const viewportBox = (await page.locator('[data-test-viewport]').boundingBox())!;
            const x = cellBox.x + cellBox.width / 2;
            const y = viewportBox.y - 3;
            await page.evaluate(({ x, y }) => {
                const button = document.createElement('button');
                button.id = 'host-control';
                button.textContent = 'Host control';
                Object.assign(button.style, {
                    position: 'fixed',
                    left: `${x - 60}px`,
                    top: `${y - 21}px`,
                    width: '120px',
                    height: '24px',
                    zIndex: '100',
                });
                button.addEventListener('click', () => button.textContent = 'Clicked');
                document.body.appendChild(button);
            }, { x, y });

            await page.mouse.move(x, cellBox.y - 3);
            await expect.poll(() => toolbarOpacity(page)).toBe(1);
            await page.mouse.move(x, y);
            await expect.poll(() => toolbarOpacity(page)).toBe(0);
            // A queued hover must not reopen the tools over a host control.
            await page.waitForTimeout(400);
            expect(await toolbarOpacity(page)).toBe(0);
            await page.mouse.down();
            await page.mouse.up();
            await expect(page.locator('#host-control')).toHaveText('Clicked');
            expect(await getMarkdown(page)).toBe(before);
        });
    });
}
