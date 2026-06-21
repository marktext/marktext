import process from 'node:process';
import { expect, test } from '../fixtures/muya';

// marktext #3836: a link inside a *multi-line* raw HTML block renders into
// `.mu-html-preview` as a plain `<a>` (no `mu-raw-html` wrapper class), so the
// link click handler never matched it and Cmd/Ctrl-click did nothing. Inline
// `<a href>text</a>` (rendered as `a.mu-raw-html`) already worked.

const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';

test('Cmd/Ctrl-click a link inside a multi-line HTML block emits format-click', async ({ page }) => {
    await page.evaluate(() => {
        window.muya!.setContent('<a href="https://www.example.com/">\nMarkText\n</a>\n');
        (window as unknown as { __fc: string[] }).__fc = [];
        window.muya!.eventCenter.subscribe('format-click', (payload: { data?: { href?: string } }) => {
            (window as unknown as { __fc: string[] }).__fc.push(payload?.data?.href ?? '');
        });
    });

    await expect(page.locator('.mu-html-preview a[href]').first()).toBeVisible();

    // Dispatch a real modifier-click on the anchor element itself. The anchor
    // text is newline-wrapped inside the preview, so a positional click is
    // unreliable; dispatching on the element exercises the delegated handler
    // deterministically.
    const fired = await page.evaluate((meta) => {
        const a = document.querySelector('.mu-html-preview a[href]');
        a?.dispatchEvent(new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            metaKey: meta,
            ctrlKey: !meta,
        }));
        return (window as unknown as { __fc: string[] }).__fc;
    }, MOD === 'Meta');

    expect(fired).toContain('https://www.example.com/');
});
