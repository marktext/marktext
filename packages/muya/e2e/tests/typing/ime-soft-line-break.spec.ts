import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { editor } from '../helpers/selectors';

// #5279 — a Shift+Enter soft line break was lost when the following text came
// from a CJK IME. Chromium drops the trailing `\n` from the DOM the moment
// anything is typed after it; `lineBreakAutoPair` puts it back, but the IME
// commit never reached that repair, so both lines collapsed into one.
//
// Driven through CDP `Input.imeSetComposition` — the browser then runs its own
// composition machinery and mutates the DOM itself. `ime.spec.ts` hand-builds
// the event sequence instead, which cannot catch this class of bug: the DOM
// state it stages is the one the test author expects, not the one Chromium
// produces.

test.describe('soft line break followed by an IME commit', () => {
    test.skip(
        ({ browserName }) => browserName !== 'chromium',
        'Input.imeSetComposition is a Chrome DevTools Protocol command',
    );

    async function seedFirstLine(page: Page): Promise<void> {
        await page.evaluate(() => window.muya!.setContent(''));
        await page.locator(editor.paragraph).first().click();
        await page.keyboard.insertText('第一行');
        await page.keyboard.press('Shift+Enter');
        await expect(page.locator(editor.softLineBreak)).toHaveCount(1);
    }

    test('keeps the soft line break when the IME commits the second line', async ({ page }) => {
        await seedFirstLine(page);

        const cdp = await page.context().newCDPSession(page);
        const compositionStarts: number[] = [];
        await page.exposeFunction('__onCompositionStart', () => {
            compositionStarts.push(1);
        });
        await page.evaluate(() => {
            document
                .querySelector('.mu-editor')!
                .addEventListener('compositionstart', () => window.__onCompositionStart!(), true);
        });

        await cdp.send('Input.imeSetComposition', {
            text: 'dierhang',
            selectionStart: 8,
            selectionEnd: 8,
        });

        // Mid-composition, not just at the end. The commit is rebuilt from the
        // model plus `event.data`, so it comes out right even when the browser
        // has eaten the newline — only the live DOM shows whether the newline
        // survived the composition, and only the newline surviving keeps the
        // input method's own buffer intact (#3468).
        await expect
            .poll(() => page.evaluate(() => window.muya!.editor.activeContentBlock?.domNode?.textContent))
            .toContain('第一行\n');

        await cdp.send('Input.imeSetComposition', {
            text: '第二行',
            selectionStart: 3,
            selectionEnd: 3,
        });
        await cdp.send('Input.insertText', { text: '第二行' });

        await expect.poll(() => getMarkdown(page)).toBe('第一行\n第二行\n');
        // A newline the browser overwrites takes the composition down with it,
        // and the input method restarts — one composition means it never did.
        expect(compositionStarts).toHaveLength(1);
    });

    test('keeps the soft line break when the second line is typed without an IME', async ({ page }) => {
        await seedFirstLine(page);

        await page.keyboard.insertText('abc');

        await expect.poll(() => getMarkdown(page)).toBe('第一行\nabc\n');
    });
});
