import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
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
        await expect.poll(() => getMarkdown(page)).toBe(`> [!${type}]\n> Body\n`);
        const html = await page.evaluate(async () => new window.MarkdownToHtml!(window.muya!.getMarkdown(), window.muya!).generate());
        expect(html).toContain(`markdown-alert-${type.toLowerCase()}`);
        expect(html).not.toContain('mu-alert-title');
    });
}

test('formatting the first body paragraph preserves its alert', async ({ page }) => {
    await page.evaluate(() => window.muya!.setContent('> [!NOTE]\n> Body'));
    await page.locator('.mu-github-alert .mu-paragraph-content').last().click();
    await page.evaluate(() => window.muya!.updateParagraph('heading 2'));
    await expect(page.locator('.mu-github-alert h2')).toContainText('Body');
    await expect.poll(() => getMarkdown(page)).toContain('[!NOTE]');
});

for (const body of ['```js\nBody\n```', '> Body', '- Body']) {
    test(`backspace unwraps ${JSON.stringify(body)} before the alert`, async ({ page }) => {
        await page.evaluate((body) => {
            const muya = window.muya!;
            muya.setContent(`> [!NOTE]\n>\n${body.split('\n').map(line => `> ${line}`).join('\n')}`);
            const quote = muya.editor.scrollPage!.firstChild!;
            if (!quote.isParent())
                throw new Error('Expected an alert');
            const inner = quote.find(0)!;
            if (!inner.isParent())
                throw new Error('Expected an inner block');
            let content = inner.firstContentInDescendant()!;
            if (content.blockName === 'language-input')
                content = content.nextContentInContext()!;
            content.setCursor(0, 0, true);
        }, body);
        await page.keyboard.press('Backspace');
        await expect(page.locator('.mu-github-alert')).toHaveCount(1);
        await expect(page.locator('.mu-github-alert > .mu-paragraph').last()).toHaveText('Body');
        await expect(page.locator('.mu-github-alert pre, .mu-github-alert blockquote, .mu-github-alert ul')).toHaveCount(0);
        await page.keyboard.press('Backspace');
        await expect(page.locator('.mu-github-alert')).toHaveCount(0);
        await expect.poll(() => getMarkdown(page)).toBe('> Body\n');
    });
}

test('backspace unwraps code, list, quote and alert one layer at a time', async ({ page }) => {
    await page.evaluate(() => {
        const muya = window.muya!;
        muya.setContent('> [!NOTE]\n>\n> > - ```\n> >   Body\n> >   ```');
        const code = muya.editor.scrollPage!.lastContentInDescendant()!;
        code.setCursor(0, 0, true);
    });
    for (const selector of ['pre', 'ul', 'blockquote']) {
        await page.keyboard.press('Backspace');
        await expect(page.locator('.mu-github-alert')).toHaveCount(1);
        await expect(page.locator(`.mu-github-alert ${selector}`)).toHaveCount(0);
        await expect.poll(() => getMarkdown(page)).toContain('Body');
    }
    await page.keyboard.press('Backspace');
    await expect(page.locator('.mu-github-alert')).toHaveCount(0);
    await expect.poll(() => getMarkdown(page)).toBe('> Body\n');
});

test('pastes GitHub HTML and keeps types through disabled rendering', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'Native HTML clipboard permissions require Chromium.');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.evaluate(async () => {
        await navigator.clipboard.write([new ClipboardItem({
            'text/html': new Blob(['<div class="markdown-alert markdown-alert-important"><p class="markdown-alert-title"><svg></svg>Important</p><p><strong>Body</strong></p></div>'], { type: 'text/html' }),
            'text/plain': new Blob(['Important\nBody'], { type: 'text/plain' }),
        })]);
    });
    // Native paste needs Muya's selection and focus on the outer editing host.
    await page.evaluate(() => {
        window.muya!.focus();
        window.muya!.domNode.focus();
    });
    await expect(page.locator('.mu-editor')).toBeFocused();
    await page.keyboard.press(`${metaKey()}+v`);
    await expect(page.locator('.mu-github-alert .mu-alert-title')).toHaveText('Important');
    const markdown = await getMarkdown(page);
    expect(markdown).toContain('[!IMPORTANT]');
    expect(markdown).not.toContain('Important');
    await page.evaluate(() => window.muya!.setOptions({ githubAlerts: false }, true));
    await expect(page.locator('.mu-github-alert')).toHaveCount(0);
    expect(await getMarkdown(page)).toBe(markdown);
    await page.evaluate(() => window.muya!.setOptions({ githubAlerts: true }, true));
    await expect(page.locator('.mu-github-alert')).toHaveCount(1);
});
