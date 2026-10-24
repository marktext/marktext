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

for (const refresh of ['options', 'locale']) {
    test(`${refresh} rebuild preserves a pending edit and subsequent typing`, async ({ page }) => {
        await page.evaluate((refresh) => {
            const muya = window.muya!;
            muya.setContent('seed\n');
            const content = muya.editor.scrollPage!.firstContentInDescendant()!;
            content.text = 'changed';
            content.update();
            if (refresh === 'options')
                muya.setOptions({ codeBlockLineNumbers: true }, true);
            else
                muya.locale({ name: 'review-test', resource: {} });
            muya.flush();
            muya.editor.history.cutoff();
            muya.editor.scrollPage!.firstContentInDescendant()!.setCursor(7, 7, true);
        }, refresh);
        await expect(page.locator(editor.paragraphContent)).toHaveText('changed');
        await page.keyboard.type('!');
        await page.evaluate(() => window.muya!.flush());
        expect(await page.evaluate(() => window.muya!.getMarkdown())).toBe('changed!\n');
        await expect(page.locator(editor.paragraphContent)).toHaveText('changed!');
        await page.evaluate(() => window.muya!.undo());
        await expect(page.locator(editor.paragraphContent)).toHaveText('changed');
    });

    test(`a scoped ${refresh} rebuild is rejected before changing configuration`, async ({ page }) => {
        const result = await page.evaluate((refresh) => {
            const muya = window.muya!;
            muya.setContent('seed\n');
            const language = muya.i18n.lang;
            const lineNumbers = muya.options.codeBlockLineNumbers;
            let error = '';
            try {
                muya.transact(() => {
                    const content = muya.editor.scrollPage!.firstContentInDescendant()!;
                    content.text = 'changed';
                    content.update();
                    if (refresh === 'options')
                        muya.setOptions({ codeBlockLineNumbers: !lineNumbers }, true);
                    else
                        muya.locale({ name: 'review-test', resource: {} });
                });
            }
            catch (caught) {
                error = String(caught);
            }
            return {
                error,
                languageUnchanged: muya.i18n.lang === language,
                optionUnchanged: muya.options.codeBlockLineNumbers === lineNumbers,
                markdown: muya.getMarkdown(),
                undo: muya.getHistory().stack.undo.length,
            };
        }, refresh);
        expect(result.error).toContain('cannot run inside an edit transaction');
        expect(result.languageUnchanged).toBe(true);
        expect(result.optionUnchanged).toBe(true);
        expect(result.markdown).toBe('seed\n');
        expect(result.undo).toBe(0);
        await expect(page.locator(editor.paragraphContent)).toHaveText('seed');
    });
}

test('rollback restores the visible document after a command enables read-only mode', async ({ page }) => {
    const error = await page.evaluate(() => {
        const muya = window.muya!;
        muya.setContent('seed\n');
        try {
            muya.transact(() => {
                const content = muya.editor.scrollPage!.firstContentInDescendant()!;
                content.text = 'changed';
                content.update();
                muya.setReadOnly(true);
                throw new Error('abort locked command');
            });
        }
        catch (error) {
            return String(error);
        }
        return '';
    });
    expect(error).toContain('abort locked command');
    await expect(page.locator(editor.paragraphContent)).toHaveText('seed');
    await expect(page.locator(editor.paragraphContent)).toHaveAttribute('contenteditable', 'false');
    expect(await page.evaluate(() => ({
        markdown: window.muya!.getMarkdown(),
        canMutate: window.muya!.canMutate,
        undo: window.muya!.getHistory().stack.undo.length,
    }))).toEqual({ markdown: 'seed\n', canMutate: false, undo: 0 });
    await page.evaluate(() => {
        window.muya!.setReadOnly(false);
        window.muya!.editor.scrollPage!.firstContentInDescendant()!.setCursor(4, 4, true);
    });
    await page.keyboard.type('!');
    await page.evaluate(() => window.muya!.flush());
    expect(await page.evaluate(() => window.muya!.getMarkdown())).toBe('seed!\n');
    await expect(page.locator(editor.paragraphContent)).toHaveText('seed!');
});
