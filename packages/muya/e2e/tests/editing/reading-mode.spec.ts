import type { Page } from '@playwright/test';
import { CopyType } from '../../../src/clipboard/types';
import { expect, test } from '../fixtures/muya';

async function hoverFrontButton(page: Page) {
    await page.locator('p.mu-paragraph').first().hover();
    const wrapper = page.locator('.mu-front-button-wrapper');
    await expect.poll(() => wrapper.evaluate(el => (el as HTMLElement).style.opacity)).toBe('1');
    const handle = page.locator('.mu-front-button .mu-icon-wrapper');
    await handle.hover();
    return handle;
}

test('heading controls copy anchors without previewing their icon, while document images still open', async ({ page }) => {
    await page.route('**/reading-image.svg', route => route.fulfill({
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="blue"/></svg>',
    }));
    await page.evaluate(() => {
        const muya = window.muya!;
        const imageUrl = new URL('/reading-image.svg', window.location.href).href;
        muya.setContent(`# Heading\n\n![sample](${imageUrl})`);
        muya.setReadOnly(true);
        muya.on('heading-copy-link', () => { document.body.dataset.copiedHeading = String(Number(document.body.dataset.copiedHeading ?? '0') + 1); });
        muya.on('preview-image', ({ data }: { data: string }) => { document.body.dataset.previewedImage = data; });
    });
    await page.locator('h1').hover();
    await page.locator('.mu-copy-header-link img').click();
    await expect(page.locator('body')).toHaveAttribute('data-copied-heading', '1');
    await page.locator('.mu-copy-header-link').focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    await expect(page.locator('body')).toHaveAttribute('data-copied-heading', '3');
    await expect(page.locator('body')).not.toHaveAttribute('data-previewed-image');
    await page.locator('.mu-image-container img').click();
    await expect(page.locator('body')).toHaveAttribute('data-previewed-image', /\/reading-image\.svg$/);
});

test('reading front icons stay static on hover and reject menus, custom dragging and native dragging', async ({ page }) => {
    await page.evaluate(() => {
        window.muya!.setContent('PARA-A\n\nPARA-B');
        window.muya!.setReadOnly(true);
        window.muya!.on('muya-front-menu', () => { document.body.dataset.frontMenuOpened = 'true'; });
    });
    const before = await page.evaluate(() => window.muya!.getMarkdown());
    const handle = await hoverFrontButton(page);
    await expect(handle.locator('i.paragraph')).toBeVisible();
    await expect(handle.locator('i.drag')).toHaveCount(0);
    expect(await handle.evaluate(el => getComputedStyle(el).cursor)).toBe('default');
    expect(await handle.evaluate(el => el.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true })))).toBe(false);
    await page.mouse.down();
    await page.waitForTimeout(400);
    await expect(page.locator('.mu-shadow, .mu-line-ghost')).toHaveCount(0);
    await page.locator('p.mu-paragraph').last().hover();
    await page.mouse.up();
    await handle.click();
    await expect(page.locator('body')).not.toHaveAttribute('data-front-menu-opened');
    expect(await page.evaluate(() => window.muya!.getMarkdown())).toBe(before);
});

test('locking cancels both an armed and an active front-button drag without moving paragraphs', async ({ page }) => {
    await page.evaluate(() => window.muya!.setContent('PARA-A\n\nPARA-B'));
    const before = await page.evaluate(() => window.muya!.getMarkdown());
    await hoverFrontButton(page);
    await page.mouse.down();
    await page.evaluate(() => { window.muya!.setReadOnly(true); window.muya!.setReadOnly(false); });
    await page.waitForTimeout(400);
    await expect(page.locator('.mu-shadow, .mu-line-ghost')).toHaveCount(0);
    await page.locator('p.mu-paragraph').last().hover();
    await page.mouse.up();

    await hoverFrontButton(page);
    await page.mouse.down();
    await expect(page.locator('.mu-shadow')).toHaveCount(1);
    await page.evaluate(() => window.muya!.setReadOnly(true));
    await expect(page.locator('.mu-shadow, .mu-line-ghost')).toHaveCount(0);
    expect(await page.locator('body').evaluate(el => getComputedStyle(el).cursor)).not.toBe('grabbing');
    await page.locator('p.mu-paragraph').last().hover();
    await page.mouse.up();
    expect(await page.evaluate(() => window.muya!.getMarkdown())).toBe(before);
});

test('reading blocks native edits, tasks and public commands while retaining previews', async ({ page }) => {
    await page.evaluate(() => {
        const muya = window.muya!;
        muya.setContent('**bold** and $x^2$\n\n- [ ] task\n\n<div>rendered HTML</div>');
        muya.setReadOnly(true);
    });
    const before = await page.evaluate(() => window.muya!.getMarkdown());
    await page.locator('.mu-math-render').click();
    await page.keyboard.type('cannot insert');
    await page.keyboard.press('Backspace');
    await page.locator('input[type=checkbox]').click();
    await page.locator('.mu-html-preview').click();
    await page.evaluate(() => {
        window.muya!.updateParagraph('heading 1');
        window.muya!.undo();
        window.muya!.flush();
    });
    expect(await page.evaluate(() => window.muya!.getMarkdown())).toBe(before);
    await expect(page.locator('.mu-editor [contenteditable=true]')).toHaveCount(0);
    await expect(page.locator('.mu-editor .mu-active')).toHaveCount(0);
    await expect(page.locator('.mu-html-preview')).toBeVisible();
    await expect(page.locator('.mu-math-render')).toBeVisible();
});

for (const mode of [CopyType.NORMAL, CopyType.COPY_AS_MARKDOWN, CopyType.COPY_AS_HTML, CopyType.COPY_AS_RICH]) {
    test(`reading selection reuses the ${mode} clipboard pipeline`, async ({ page }) => {
        const copied = await page.evaluate((mode) => {
            const muya = window.muya!;
            muya.setContent('**bold** and [link](https://example.com) :smile: &amp;\n\nsecond paragraph');
            muya.setReadOnly(true);
            muya.domNode.focus();
            muya.selectAll();
            const clipboard = muya.editor.clipboard;
            const originalType = clipboard.copyType;
            clipboard.copyType = mode;
            const clipboardData = new DataTransfer();
            muya.domNode.dispatchEvent(new ClipboardEvent('copy', { bubbles: true, clipboardData }));
            clipboard.copyType = originalType;
            return { text: clipboardData.getData('text/plain'), html: clipboardData.getData('text/html') };
        }, mode);
        if (mode === CopyType.COPY_AS_HTML)
            expect(copied.text).toContain('<strong>bold</strong>');
        else
            expect(copied.text).toBe('**bold** and [link](https://example.com) :smile: &amp;\n\nsecond paragraph\n');
        if (mode === CopyType.COPY_AS_RICH)
            expect(copied.html).toContain('<strong>bold</strong>');
        else
            expect(copied.html).toBe('');
    });
}

test('links open on click or Enter and double-click remains selection', async ({ page }) => {
    await page.evaluate(() => {
        const muya = window.muya!;
        muya.setContent('[example](https://example.com)');
        muya.setReadOnly(true);
        muya.on('format-click', ({ data }: { data: { href: string } }) => { document.body.dataset.opened = data.href; });
    });
    const link = page.locator('.mu-link');
    await link.click();
    await expect(page.locator('body')).toHaveAttribute('data-opened', 'https://example.com');
    await page.evaluate(() => { delete document.body.dataset.opened; });
    await link.dblclick();
    await page.waitForTimeout(350);
    await expect(page.locator('body')).not.toHaveAttribute('data-opened');
    expect(await page.evaluate(() => document.getSelection()?.toString())).toBe('example');
    await page.evaluate(() => document.getSelection()?.removeAllRanges());
    await link.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('body')).toHaveAttribute('data-opened', 'https://example.com');
});

test('dragging to select link text does not follow the link', async ({ page }) => {
    await page.evaluate(() => {
        const muya = window.muya!;
        muya.setContent('before [select some link text](https://example.com)');
        muya.setReadOnly(true);
        muya.on('format-click', () => { document.body.dataset.opened = 'true'; });
    });
    const bounds = await page.locator('.mu-link').boundingBox();
    if (!bounds)
        throw new Error('Expected visible link');
    const paragraph = await page.locator('p.mu-paragraph').boundingBox();
    if (!paragraph)
        throw new Error('Expected visible paragraph');
    await page.mouse.move(paragraph.x + 2, bounds.y + bounds.height / 2);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width - 2, bounds.y + bounds.height / 2, { steps: 10 });
    await page.mouse.up();
    expect(await page.evaluate(() => document.getSelection()?.toString())).toContain('select some link');
    await page.waitForTimeout(350);
    await expect(page.locator('body')).not.toHaveAttribute('data-opened');
});

test('code copy is keyboard accessible and copies exact code without changing the document', async ({ page }) => {
    await page.evaluate(() => {
        const muya = window.muya!;
        muya.setContent('```ts\n  const 汉字 = 1\n\n  run()\n```');
        muya.setOptions({ clipboardWriteText: async (text) => { document.body.dataset.copied = text; return true; } });
        muya.setReadOnly(true);
    });
    const before = await page.evaluate(() => window.muya!.getMarkdown());
    await page.locator('button.mu-code-copy').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('body')).toHaveAttribute('data-copied', '  const 汉字 = 1\n\n  run()');
    expect(await page.evaluate(() => window.muya!.getMarkdown())).toBe(before);
});
