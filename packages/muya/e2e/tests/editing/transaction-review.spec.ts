import { ChangeSource } from '../../../src/types';
import { expect, test } from '../fixtures/muya';
import { editor } from '../helpers/selectors';

test('a scoped API insertion resolves reference links from the candidate document', async ({ page }) => {
    const sources = await page.evaluate((source) => {
        const muya = window.muya!;
        muya.setContent('seed\n');
        const sources: string[] = [];
        const listener = (change: { source: string }) => sources.push(change.source);
        muya.on('json-change', listener);
        muya.transact(() => {
            muya.editor.updateContents([
                [1, { i: { name: 'paragraph', text: '[ref]: https://example.com' } }],
                [2, { i: { name: 'paragraph', text: '[label][ref]' } }],
            ], null, source);
        });
        muya.off('json-change', listener);
        return sources;
    }, ChangeSource.Api);
    const link = page.locator(editor.paragraphContent).locator('a');
    await expect(link).toHaveAttribute('href', 'https://example.com');
    expect(sources).toEqual([ChangeSource.Api]);
    await page.evaluate(() => window.muya!.undo());
    await expect(link).toHaveCount(0);
    expect(await page.evaluate(() => window.muya!.getMarkdown())).toBe('seed\n');
    await page.evaluate(() => window.muya!.redo());
    await expect(link).toHaveAttribute('href', 'https://example.com');
});

test('a rejected scoped replacement leaves the document, history, and caret usable', async ({ page }) => {
    const error = await page.evaluate(() => {
        const muya = window.muya!;
        muya.setContent('seed\n');
        muya.editor.scrollPage!.firstContentInDescendant()!.setCursor(4, 4, true);
        try {
            muya.transact(() => muya.setContent('replacement\n'));
        }
        catch (error) {
            return String(error);
        }
        return '';
    });
    expect(error).toContain('cannot run inside an edit transaction');
    expect(await page.evaluate(() => window.muya!.getHistory().stack.undo.length)).toBe(0);
    await page.keyboard.type('x');
    await expect(page.locator(editor.paragraphContent)).toHaveText('seedx');
    await page.evaluate(() => window.muya!.flush());
    await page.evaluate(() => window.muya!.undo());
    expect(await page.evaluate(() => window.muya!.getMarkdown())).toBe('seed\n');
});

test('checkbox clicks keep nested task list spacing and undo together', async ({ page }) => {
    await page.evaluate(() => window.muya!.setContent('- [ ] a\n  - nested\n- [ ] b\n'));
    const checkbox = page.locator('input.mu-task-list-checkbox').nth(1);
    await checkbox.click();
    await page.evaluate(() => window.muya!.flush());
    await expect(checkbox).toBeChecked();
    expect(await page.evaluate(() => window.muya!.getMarkdown())).toBe('- [ ] a\n  - nested\n- [x] b\n');
    await page.evaluate(() => window.muya!.undo());
    await expect(checkbox).not.toBeChecked();
    expect(await page.evaluate(() => window.muya!.getMarkdown())).toBe('- [ ] a\n  - nested\n- [ ] b\n');
});
