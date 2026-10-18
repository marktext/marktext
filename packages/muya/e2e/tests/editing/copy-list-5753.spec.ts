import { test, expect } from '../fixtures/muya';
import { metaKey } from '../helpers/keyboard';

test('reverse list selection copies text and pastes complete items (#5753)', async ({ browserName, context, page }) => {
    test.skip(browserName !== 'chromium', 'Requires Chromium clipboard permissions.');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.evaluate(() => {
        const muya = window.muya!;
        muya.setContent('- alpha\n- beta\n');
        muya.domNode.focus();
        const first = muya.editor.scrollPage!.firstContentInDescendant()!;
        const last = muya.editor.scrollPage!.lastContentInDescendant()!;
        first.setCursor(0, 0, true);
        const selection = document.getSelection()!;
        const firstNode = selection.anchorNode!;
        const firstOffset = selection.anchorOffset;
        last.setCursor(last.text.length, last.text.length, true);
        selection.setBaseAndExtent(selection.focusNode!, selection.focusOffset, firstNode, firstOffset);
    });

    await page.keyboard.press(`${metaKey()}+c`);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('- alpha\n- beta\n');

    await page.evaluate(() => {
        const muya = window.muya!;
        muya.setContent('- target\n');
        const target = muya.editor.scrollPage!.firstContentInDescendant()!;
        muya.domNode.focus();
        target.setCursor(target.text.length, target.text.length, true);
    });
    await page.keyboard.press('Enter');
    await page.keyboard.press(`${metaKey()}+v`);

    await expect.poll(() => page.evaluate(() => window.muya!.getMarkdown())).toBe('- target\n- alpha\n- beta\n');
});
