import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { loadMarkdown } from '../helpers/keyboard';
import { editor } from '../helpers/selectors';

// #5368: typing over a selection from the language line of a code block inside
// a list item into its code replaced the whole list with one paragraph.

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

test('typing over a selection from a nested language line into its code keeps the list (#5368)', async ({ page }) => {
    const errors = collectPageErrors(page);
    await loadMarkdown(page, '- item one\n\n  ```js\n  const a = 1\n  ```\n\n- item two\n');
    // The code re-renders once highlighted, which resets a DOM selection inside it.
    await expect(page.locator(`${editor.codeContent} .token`).first()).toBeAttached();
    await nextFrames(page);

    await page.evaluate(() => {
        const { scrollPage, selection } = window.muya!.editor;
        let languageInput = scrollPage!.firstContentInDescendant();
        while (languageInput && languageInput.blockName !== 'language-input')
            languageInput = languageInput.nextContentInContext() ?? null;
        const code = languageInput!.nextContentInContext()!;
        selection.setSelection(
            { offset: 1, block: languageInput!, path: languageInput!.path },
            { offset: 3, block: code, path: code.path },
        );
    });
    await page.keyboard.type('q');

    await expect.poll(() => getMarkdown(page)).toBe('- item one\n\n  jqst a = 1\n\n- item two\n');
    expect(errors).toEqual([]);
});
