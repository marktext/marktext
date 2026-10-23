import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';

test.beforeEach(async ({ page }) => {
    await page.evaluate(() => {
        window.muya!.setOptions({ githubAlerts: true }, true);
        window.muya!.setContent('');
    });
});

for (const type of ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION']) {
    test(`hovering ${type} displays a loadable front-button icon`, async ({ page }, testInfo) => {
        await page.evaluate(type => window.muya!.setContent(`> [!${type}]\n> Body`), type);
        await page.locator('.mu-github-alert').hover();
        const button = page.locator('.mu-front-button-wrapper');
        await expect(button).toBeInViewport();
        await expect(button).toHaveCSS('opacity', '1');
        const icon = button.locator('i.paragraph .icon-inner');
        const loaded = await icon.evaluate(async (element) => {
            const background = getComputedStyle(element).backgroundImage;
            const url = background.slice(4, -1).replace(/^"|"$/g, '');
            const image = new Image();
            image.src = url;
            try {
                await image.decode();
                return image.naturalWidth > 0;
            }
            catch {
                return false;
            }
        });
        expect(loaded).toBe(true);
        await testInfo.attach('alert-front-button', { body: await page.screenshot(), contentType: 'image/png' });
        await button.locator('.mu-icon-wrapper').click();
        await expect(page.locator('.mu-front-menu')).toBeInViewport();
    });
}

test('Quick Insert creates the searched type at the caret', async ({ page }) => {
    await page.locator('.mu-paragraph-content').click();
    await page.keyboard.type('/caution');
    const item = page.locator('.mu-quick-insert [data-label="github-alert CAUTION"]');
    await expect(item).toBeVisible();
    await item.click();
    await page.keyboard.type('Careful');
    await expect.poll(() => getMarkdown(page)).toBe('> [!CAUTION]\n> Careful\n');
});

test('front menu converts the complete container and its internal blocks', async ({ page }) => {
    await page.evaluate(() => window.muya!.setContent('> [!NOTE]\n> Body\n>\n> - item'));
    const show = async () => {
        await expect(page.locator('.mu-front-menu')).not.toBeInViewport();
        // A pointer over the old menu can send mouseleave after reopening it.
        await page.mouse.move(0, 0);
        await page.evaluate(() => {
            const block = window.muya!.editor.scrollPage!.firstChild!;
            window.muya!.eventCenter.emit('muya-front-menu', { reference: block.domNode!, block });
        });
        await expect(page.locator('.mu-front-menu')).toBeInViewport();
    };
    await show();
    await page.locator('.mu-front-menu .github-alert-TIP').click();
    await expect(page.locator('.mu-github-alert[data-alert-type="tip"]')).toHaveCount(1);
    await expect(page.locator('.mu-github-alert li')).toHaveText('item');
    await show();
    await page.locator('.mu-front-menu .turn-into-item.paragraph').click();
    await expect(page.locator('.mu-github-alert')).toHaveCount(0);
    await expect.poll(() => getMarkdown(page)).toBe('Body\n\n- item\n');
});

test('does not offer a nested alert or any alert entry while disabled', async ({ page }) => {
    await page.evaluate(() => window.muya!.setContent('- item'));
    await page.locator('.mu-paragraph-content').click();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('/note');
    await expect(page.locator('.mu-quick-insert [data-label^="github-alert "]')).toHaveCount(0);
    await page.evaluate(() => {
        window.muya!.setContent('');
        window.muya!.setOptions({ githubAlerts: false }, true);
    });
    await page.locator('.mu-paragraph-content').click();
    await page.keyboard.type('/');
    await expect(page.locator('.mu-quick-insert [data-label^="github-alert "]')).toHaveCount(0);
    await expect(page.locator('.mu-quick-insert .title', { hasText: 'GITHUB ALERTS' })).toHaveCount(0);
});
