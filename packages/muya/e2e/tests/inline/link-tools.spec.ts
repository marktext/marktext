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

    test('shows the link title before the URL in the hover preview', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent('[Docs](https://example.com "Reference")'));
        await page.locator('span.mu-link').first().hover();

        await expect(page.locator(`${floats.linkTools} .mu-link-preview`)).toHaveText('Reference');
    });

    test('lays out actions before a preview that grows to at most two lines', async ({ page }) => {
        await page.setViewportSize({ width: 640, height: 480 });
        const title = '王晗.W教师编制招聘考试培训机构营销策略研究[D].济南：山东师范大学，2025.这段补充文本用于验证悬浮预览最多显示两行。';
        await page.evaluate((previewTitle) => {
            window.muya!.setContent(`[Reference](https://example.com "${previewTitle}")`);
        }, title);
        await page.locator(editor.paragraph).first().click({ position: { x: 2, y: 2 } });
        await page.locator('span.mu-link').first().hover();

        const tools = page.locator(floats.linkTools);
        const unlink = tools.locator('li.item.unlink');
        const jump = tools.locator('li.item.jump');
        const preview = tools.locator('.mu-link-preview');
        await expect(preview).toHaveText(title);

        const [toolsBox, unlinkBox, jumpBox, previewBox] = await Promise.all([
            tools.boundingBox(),
            unlink.boundingBox(),
            jump.boundingBox(),
            preview.boundingBox(),
        ]);
        expect(toolsBox).not.toBeNull();
        expect(unlinkBox).not.toBeNull();
        expect(jumpBox).not.toBeNull();
        expect(previewBox).not.toBeNull();
        expect(unlinkBox!.x).toBeLessThan(jumpBox!.x);
        expect(jumpBox!.x + jumpBox!.width).toBeLessThanOrEqual(previewBox!.x);
        expect(toolsBox!.width).toBeGreaterThan(toolsBox!.height * 5);
        expect(toolsBox!.x).toBeGreaterThanOrEqual(8);
        expect(toolsBox!.x + toolsBox!.width).toBeLessThanOrEqual(632);

        const previewStyle = await preview.evaluate((element) => {
            const style = getComputedStyle(element);
            return {
                lineClamp: style.getPropertyValue('-webkit-line-clamp'),
                lineHeight: Number.parseFloat(style.lineHeight),
                paddingBlock: Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom),
            };
        });
        expect(previewStyle.lineClamp).toBe('2');
        expect(previewBox!.height).toBeGreaterThan(previewStyle.lineHeight + previewStyle.paddingBlock);
        expect(previewBox!.height).toBeLessThanOrEqual(previewStyle.lineHeight * 2 + previewStyle.paddingBlock + 1);
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
