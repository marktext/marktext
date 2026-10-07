import { expect, test } from '../fixtures/muya';

test('search highlight survives a force re-render (#5651)', async ({ page }) => {
    await page.evaluate(() => {
        window.muya!.setContent('line one\nline two\nline three\n');
    });
    await page.waitForTimeout(150);
    await page.evaluate(() => {
        window.muya!.editor.searchModule.search('line');
    });
    await page.waitForTimeout(150);
    const before = await page.evaluate(() =>
        document.querySelectorAll('.mu-highlight, .mu-selection').length,
    );

    await page.evaluate(() => {
        window.muya!.setOptions({ softNewlineAsSpace: true }, true);
    });
    await page.waitForTimeout(250);

    const after = await page.evaluate(() => ({
        spans: document.querySelectorAll('.mu-highlight, .mu-selection').length,
        matches: window.muya!.editor.searchModule.matches.length,
    }));

    expect(before).toBe(3);
    expect(after).toEqual({ spans: 3, matches: 3 });
});

test('caret and highlight share the block without clobbering each other (#5651)', async ({ page }) => {
    await page.evaluate(() => {
        window.muya!.setContent('line one\n\nline two\n\nline three\n');
    });
    await page.waitForTimeout(150);
    await page.evaluate(() => {
        window.muya!.editor.searchModule.search('line');
        // Caret inside the first block, which also holds the active match.
        // needUpdate=false so placing it does not itself re-render the block.
        (window.muya!.editor.scrollPage!.firstContentInDescendant() as unknown as {
            setCursor: (begin: number, end: number) => void;
        }).setCursor(2, 2);
    });
    await page.waitForTimeout(150);

    await page.evaluate(() => {
        window.muya!.setOptions({ softNewlineAsSpace: true }, true);
    });
    await page.waitForTimeout(250);

    const result = await page.evaluate(() => {
        const selection = window.getSelection();
        const anchorNode = selection?.anchorNode;
        const lineOne = (anchorNode?.parentElement ?? anchorNode)?.closest?.('.mu-paragraph-content');
        return {
            spans: document.querySelectorAll('.mu-highlight, .mu-selection').length,
            offset: selection?.anchorOffset ?? -1,
            caretText: lineOne?.textContent,
        };
    });

    expect(result).toEqual({ spans: 3, offset: 2, caretText: 'line one' });
});
