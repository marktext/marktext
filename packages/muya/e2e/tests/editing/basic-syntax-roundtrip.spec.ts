import { expect, test } from '../fixtures/muya';

test.beforeEach(async ({ page }) => {
    await page.evaluate(() => window.muya!.setOptions({ preserveSyntax: true }));
});

test('typing in a heading preserves its source spacing and closing hashes', async ({ page }) => {
    await page.evaluate(() => {
        const muya = window.muya!;
        muya.setContent('  ##   title  #### \n');
        const content = muya.editor.scrollPage!.firstContentInDescendant()!;
        content.setCursor(content.text.length, content.text.length, true);
    });
    await page.keyboard.type('!');
    await page.evaluate(() => window.muya!.flush());
    expect(await page.evaluate(() => window.muya!.getMarkdown())).toBe('  ##   title!  #### \n');
    await expect(page.locator('h2')).toHaveText('## title!');
    await page.evaluate(() => window.muya!.undo());
    expect(await page.evaluate(() => window.muya!.getMarkdown())).toBe('  ##   title  #### \n');
    await expect(page.locator('h2')).toHaveText('## title');
});

test('a code fence correction is visible in Blocks and replays through undo and redo', async ({ page }) => {
    const before = '~~~ js\ncode\n~~~~~ \n';
    const after = '~~~~~ js\ncode\n~~~~\n~~~~~ \n';
    await page.evaluate((markdown) => {
        const muya = window.muya!;
        muya.setContent(markdown);
        const content = muya.editor.scrollPage!.lastContentInDescendant()!;
        content.setCursor(content.text.length, content.text.length, true);
        muya.transact(() => {
            content.text = 'code\n~~~~';
            content.update();
        });
    }, before);
    expect(await page.evaluate(() => window.muya!.getMarkdown())).toBe(after);
    await expect(page.locator('.mu-code-block')).toHaveClass(/mu-tilde-fence/);
    await expect(page.locator('.mu-codeblock-content')).toHaveText('code\n~~~~');
    await page.evaluate(() => window.muya!.undo());
    expect(await page.evaluate(() => window.muya!.getMarkdown())).toBe(before);
    await expect(page.locator('.mu-codeblock-content')).toHaveText('code');
    await page.evaluate(() => window.muya!.redo());
    expect(await page.evaluate(() => window.muya!.getMarkdown())).toBe(after);
    await expect(page.locator('.mu-codeblock-content')).toHaveText('code\n~~~~');
});

test('changing a code language keeps its source fence and info padding', async ({ page }) => {
    await page.evaluate(() => {
        const muya = window.muya!;
        muya.setContent('~~~~  js title="demo"  \ncode\n~~~~~~ \n');
        const input = muya.editor.scrollPage!.firstContentInDescendant()!;
        input.setCursor(0, input.text.length, true);
    });
    await page.keyboard.type('text');
    await page.evaluate(() => window.muya!.flush());
    expect(await page.evaluate(() => window.muya!.getMarkdown())).toBe('~~~~  text  \ncode\n~~~~~~ \n');
    await expect(page.locator('.mu-language-input')).toHaveText('text');
    await expect(page.locator('.mu-code-block')).toHaveClass(/mu-tilde-fence/);
});

test('replacing content and undoing restores syntax without rebuilding the whole editor', async ({ page }) => {
    await page.evaluate(() => {
        const muya = window.muya!;
        muya.setContent('##   title ### \n');
        muya.replaceContent('##\ttitle ####\t\n');
    });
    expect(await page.evaluate(() => window.muya!.getMarkdown())).toBe('##\ttitle ####\t\n');
    await page.evaluate(() => window.muya!.undo());
    expect(await page.evaluate(() => window.muya!.getMarkdown())).toBe('##   title ### \n');
    await expect(page.locator('h2')).toHaveText('## title');
});
