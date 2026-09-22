import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { loadMarkdown } from '../helpers/keyboard';
import { editor } from '../helpers/selectors';

// #5371: Backspace over a selection that ends in a code block's language line
// duplicated the language into the start paragraph and removed the language
// input, so the language could no longer be edited.

function collectPageErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(String(err?.message ?? err)));
    return errors;
}

async function nextFrames(page: Page): Promise<void> {
    await page.evaluate(() => new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }));
}

test('a cut ending in a language line keeps the code block and its language input (#5371)', async ({ page }) => {
    const errors = collectPageErrors(page);
    await loadMarkdown(page, 'intro\n\n- item\n\n  ```js\n  const a = 1\n  ```\n\n  tail\n');
    await expect(page.locator(`${editor.codeContent} .token`).first()).toBeAttached();
    await nextFrames(page);

    await page.evaluate(() => {
        const { scrollPage, selection } = window.muya!.editor;
        const intro = scrollPage!.firstContentInDescendant()!;
        let languageInput = intro.nextContentInContext();
        while (languageInput && languageInput.blockName !== 'language-input')
            languageInput = languageInput.nextContentInContext() ?? null;
        selection.setSelection(
            { offset: 2, block: intro, path: intro.path },
            { offset: 0, block: languageInput!, path: languageInput!.path },
        );
    });
    await page.keyboard.press('Backspace');
    await expect.poll(() => getMarkdown(page)).toBe('in\n\n- ```js\n  const a = 1\n  ```\n\n  tail\n');
    await expect(page.locator(`${editor.codeBlock} ${editor.languageInput}`)).toHaveCount(1);

    // The language input is still there and editable.
    await page.evaluate(() => {
        let languageInput = window.muya!.editor.scrollPage!.firstContentInDescendant();
        while (languageInput && languageInput.blockName !== 'language-input')
            languageInput = languageInput.nextContentInContext() ?? null;
        languageInput!.setCursor(2, 2, true);
    });
    await page.keyboard.type('x');
    await expect.poll(() => getMarkdown(page)).toBe('in\n\n- ```jsx\n  const a = 1\n  ```\n\n  tail\n');
    expect(errors).toEqual([]);
});
