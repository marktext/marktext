import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { slowType } from '../helpers/keyboard';
import { floats } from '../helpers/selectors';

// Regression for #4654 — selecting a language for a code block whose ancestor
// has been detached (orphaned `language-input`) must not crash the renderer.
//
// The picker stays open while its target block is converted away: a Backspace
// at offset 0 of the code body (codeBlockContent.backspaceHandler) replaces the
// <pre> with a paragraph, so the language-input is still wired to its code
// block but that code block is no longer in the document. Selecting a language
// then runs `block.text = name`, whose setter re-computes an OT path that walks
// up through the detached code block — `codeBlock.path` dereferenced a null
// parent and threw `Cannot destructure property 'path' of 'this.parent'`.
//
// The fix bails in `selectItem` when `block.outMostBlock` is null (not attached
// to the document root). This spec drives the real `CodeBlockLanguageSelector`
// float in Chromium and asserts no uncaught `pageerror`.

async function focusFirstLanguageInput(page: Page): Promise<void> {
    await page.evaluate(() => {
        const codeBlock = window.muya!.editor.scrollPage.firstChild;
        codeBlock.firstContentInDescendant().setCursor(0, 0, true);
    });
    await expect
        .poll(() => page.evaluate(() => window.muya!.editor.activeContentBlock?.blockName))
        .toBe('language-input');
}

test('#4654 selecting a language after the code block is detached does not crash', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(String(err?.message ?? err)));

    // Code block nested in a list item — the #4654 context.
    await page.evaluate(() => window.muya!.setContent('- \n  ```\n  code\n  ```\n'));
    await focusFirstLanguageInput(page);
    await slowType(page, 'pyth');
    await expect(page.locator(floats.codeBlockLanguageSelector)).toBeVisible();

    // Detach the code block from the document without moving the caret, so the
    // picker stays up with a now-orphaned language-input target. (A caret move
    // would trip the selection-change auto-hide; this isolates the selectItem
    // guard, which is the last-resort net for any detach the auto-hide misses.)
    await page.evaluate(() => {
        const langInput = window.muya!.editor.activeContentBlock;
        langInput.parent.remove();
    });

    // Click the language item that is still rendered in the open picker.
    await page
        .locator(`${floats.codeBlockLanguageSelector} li.item[data-label="python"]`)
        .click({ force: true });
    await page.waitForTimeout(200);

    expect(errors, `renderer pageerrors: ${errors.join(' | ')}`).toEqual([]);
});
