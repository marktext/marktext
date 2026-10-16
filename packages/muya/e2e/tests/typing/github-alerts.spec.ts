import { expect, test } from '../fixtures/muya';
import { metaKey } from '../helpers/keyboard';

const types = ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION'];

test.beforeEach(async ({ page }) => {
    await page.evaluate(() => {
        window.muya!.setOptions({ githubAlerts: true }, true);
        window.muya!.setContent('');
    });
});

for (const type of types) {
    test(`types a ${type} alert using a quote and Enter`, async ({ page }) => {
        await page.locator('.mu-paragraph-content').click();
        await page.keyboard.type('> ');
        await page.keyboard.type(`[!${type}]`);
        await expect(page.locator('.mu-github-alert')).toHaveCount(0);
        await page.keyboard.press('Enter');
        await expect(page.locator('.mu-github-alert')).toHaveCount(1);
        await page.keyboard.type('Body');
        await expect(page.locator('.mu-github-alert .mu-paragraph-content').last()).toHaveText('Body');
        await expect.poll(() => page.evaluate(() => window.muya!.getMarkdown())).toBe(`> [!${type}]\n> Body\n`);
        const html = await page.evaluate(async () => new window.MarkdownToHtml!(window.muya!.getMarkdown(), window.muya!).generate());
        expect(html).toContain(`markdown-alert-${type.toLowerCase()}`);
        expect(html).not.toContain('mu-alert-title');
    });
}

test('Quick Insert creates the searched type at the caret', async ({ page }) => {
    await page.locator('.mu-paragraph-content').click();
    await page.keyboard.type('/caution');
    const item = page.locator('.mu-quick-insert [data-label="github-alert CAUTION"]');
    await expect(item).toBeVisible();
    await item.click();
    await page.keyboard.type('Careful');
    await expect.poll(() => page.evaluate(() => window.muya!.getMarkdown())).toBe('> [!CAUTION]\n> Careful\n');
});

test('front menu converts the complete container and its internal blocks', async ({ page }) => {
    await page.evaluate(() => window.muya!.setContent('> [!NOTE]\n> Body\n>\n> - item'));
    const show = async () => {
        await page.evaluate(() => {
            const block = window.muya!.editor.scrollPage!.firstChild!;
            window.muya!.eventCenter.emit('muya-front-menu', { reference: block.domNode!, block });
        });
    };
    await show();
    await page.locator('.mu-front-menu .github-alert-TIP').click();
    await expect(page.locator('.mu-github-alert[data-alert-type="tip"]')).toHaveCount(1);
    await expect(page.locator('.mu-github-alert li')).toHaveText('item');
    await show();
    await page.locator('.mu-front-menu .turn-into-item.paragraph').click();
    await expect(page.locator('.mu-github-alert')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => window.muya!.getMarkdown())).toBe('Body\n\n- item\n');
});

test('formatting the first body paragraph preserves its alert', async ({ page }) => {
    await page.evaluate(() => window.muya!.setContent('> [!NOTE]\n> Body'));
    await page.locator('.mu-github-alert .mu-paragraph-content').last().click();
    await page.evaluate(() => window.muya!.updateParagraph('heading 2'));
    await expect(page.locator('.mu-github-alert h2')).toContainText('Body');
    await expect.poll(() => page.evaluate(() => window.muya!.getMarkdown())).toContain('[!NOTE]');
});

test('pastes GitHub HTML and keeps types through disabled rendering and undo', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'Native HTML clipboard permissions require Chromium.');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.locator('.mu-paragraph-content').click();
    await page.evaluate(async () => {
        await navigator.clipboard.write([new ClipboardItem({
            'text/html': new Blob(['<div class="markdown-alert markdown-alert-important"><p class="markdown-alert-title"><svg></svg>Important</p><p><strong>Body</strong></p></div>'], { type: 'text/html' }),
            'text/plain': new Blob(['Important\nBody'], { type: 'text/plain' }),
        })]);
    });
    await page.keyboard.press(`${metaKey()}+v`);
    await expect(page.locator('.mu-github-alert .mu-alert-title')).toHaveText('Important');
    const markdown = await page.evaluate(() => window.muya!.getMarkdown());
    expect(markdown).toContain('[!IMPORTANT]');
    expect(markdown).not.toContain('Important');
    await page.evaluate(() => window.muya!.setOptions({ githubAlerts: false }, true));
    await expect(page.locator('.mu-github-alert')).toHaveCount(0);
    expect(await page.evaluate(() => window.muya!.getMarkdown())).toBe(markdown);
    await page.evaluate(() => window.muya!.undo());
    await expect.poll(() => page.evaluate(() => window.muya!.getMarkdown())).not.toContain('Body');
    await page.evaluate(() => {
        window.muya!.redo();
        window.muya!.setOptions({ githubAlerts: true }, true);
    });
    await expect(page.locator('.mu-github-alert')).toHaveCount(1);
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
