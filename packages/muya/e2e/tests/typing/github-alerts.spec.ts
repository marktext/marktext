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

test('preference changes preserve the undo caret for later typing', async ({ page }) => {
    const offset = await page.evaluate(() => {
        const muya = window.muya!;
        muya.setContent('Body');
        muya.editor.scrollPage!.firstContentInDescendant()!.setCursor(2, 2, true);
        muya.updateParagraph('github-alert NOTE');
        muya.setOptions({ githubAlerts: false }, true);
        return muya.editor.selection.getSelection()!.anchor.offset;
    });
    const source = await getMarkdown(page);
    await page.keyboard.type('X');
    await expect.poll(() => getMarkdown(page)).toContain('BoXdy');
    await page.locator('#undo').click();
    await expect.poll(() => getMarkdown(page)).toBe(source);
    expect(await page.evaluate(() => window.muya!.editor.selection.getSelection()?.anchor.offset)).toBe(offset);
});

test('pastes GitHub HTML and keeps types through disabled rendering and undo', async ({ page, context, browserName }) => {
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
    await page.evaluate(() => window.muya!.undo());
    await expect.poll(() => getMarkdown(page)).not.toContain('Body');
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
