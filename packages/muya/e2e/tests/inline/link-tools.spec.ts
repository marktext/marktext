import { expect, test } from '../fixtures/muya';
import { editor, floats } from '../helpers/selectors';

test.describe('link tools', () => {
    test('hovering an inline link reveals the LinkTools toolbar', async ({ page }) => {
        await page.evaluate(() => {
            window.muya!.setContent('Here is a [link](https://example.com) inline.');
        });
        // Click outside the link first so the source markers collapse (mu-hide)
        // — LinkTools only pops on preview mode.
        await page.locator(editor.paragraph).first().click({ position: { x: 2, y: 2 } });
        const link = page.locator('span.mu-link').first();
        await expect(link).toBeVisible();
        await link.hover();
        await expect(page.locator(floats.linkTools)).toBeVisible();
    });

    test('clicking the LinkTools jump button fires the jumpClick callback', async ({ page }) => {
        await page.evaluate(() => {
            window.muya!.setContent('Visit [Example](https://example.com) site.');
            window.__e2e!.linkJumps.length = 0;
        });
        // Settle into preview mode so the source markers collapse and the
        // LinkTools popover is reachable.
        await page.locator(editor.paragraph).first().click({ position: { x: 2, y: 2 } });
        await page.locator('span.mu-link').first().hover();
        await expect(page.locator(floats.linkTools)).toBeVisible();

        // The jump action renders as `li.item.jump` inside the popover
        // (`linkTools/index.ts` line 124 builds `li.item.${i.type}`). Clicking
        // it routes through selectItem(item) → options.jumpClick(linkInfo),
        // which the host wires to push into window.__e2e.linkJumps.
        const jumpButton = page.locator(`${floats.linkTools} li.item.jump`);
        await expect(jumpButton).toBeVisible();
        await jumpButton.click();

        const jumps = await page.evaluate(() => window.__e2e!.linkJumps.slice());
        expect(jumps).toHaveLength(1);
        expect(jumps[0].href).toBe('https://example.com');
    });
});
