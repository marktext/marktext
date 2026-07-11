import { expect, test } from '../fixtures/muya';
import { metaKey, slowType } from '../helpers/keyboard';

// #4899: pasting paragraphs into a fresh list item, starting a second list a
// line up, outdenting it with Shift+Tab and backspacing the line below made
// the deferred state flush throw `Cannot use numerical key for object
// container` (ot-json1 rejecting the composed op). Replays the reporter's
// exact keystrokes.
test('paste + outdent + backspace list editing does not crash the state flush', async ({ browserName, context, page }) => {
    test.skip(browserName !== 'chromium', 'ClipboardItem unreliable on Firefox/WebKit headless — BACKLOG Phase 3.');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    const pageErrors: string[] = [];
    page.on('pageerror', err => pageErrors.push(err.message));
    page.on('console', (msg) => {
        if (msg.type() === 'error')
            pageErrors.push(msg.text());
    });

    await page.evaluate(async () => {
        window.muya!.setContent('');
        await navigator.clipboard.write([
            new ClipboardItem({
                'text/plain': new Blob(['a\n\nb\n\nc'], { type: 'text/plain' }),
            }),
        ]);
        window.muya!.focus();
        window.muya!.domNode.focus();
    });

    // `- ` starts a bullet list, then paste the three paragraphs into it.
    await slowType(page, '- ');
    await page.keyboard.press(`${metaKey()}+v`);
    await page.waitForTimeout(100);

    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowLeft');
    await slowType(page, '- ');
    await page.keyboard.press('Shift+Tab');
    await page.waitForTimeout(100);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Backspace');

    // Let the rAF-deferred JSONState flush run before judging.
    await page.waitForTimeout(300);

    expect(pageErrors, `renderer errors: ${pageErrors.join('\n')}`).toEqual([]);
    // The editor must still round-trip to markdown with nothing lost.
    const md = await page.evaluate(() => window.muya!.getMarkdown());
    for (const text of ['a', 'b', 'c'])
        expect(md).toContain(text);
});
