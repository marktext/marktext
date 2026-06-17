import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { getMarkdown, getState } from '../helpers/api';
import { slowType } from '../helpers/keyboard';
import { editor, floats, quickInsertItem } from '../helpers/selectors';

/** A muya state node as returned by `muya.getState()`. */
interface IStateNode {
    name: string;
    text?: string;
    children?: IStateNode[];
}

/** Read the top-level document state as a typed array of blocks. */
async function getBlocks(page: Page): Promise<IStateNode[]> {
    return (await getState(page)) as IStateNode[];
}

test.describe('blockquote and thematic break', () => {
    test('slash menu creates a block quote', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent(''));
        await page.locator(editor.paragraph).first().click();
        await page.keyboard.type('/');
        await expect(page.locator(floats.quickInsert)).toBeVisible();
        await page.locator(quickInsertItem('block-quote')).click();
        const quote = page.locator(editor.blockQuote).first();
        await expect(quote).toBeVisible();
        // The slash menu only hides via opacity, not display, so we cannot use
        // toBeHidden. Instead we click directly into the new block-quote's
        // inner paragraph, which both moves the cursor and forces focus there.
        await quote.locator(editor.paragraph).first().click();
        await slowType(page, 'quoted');
        await expect(quote.locator(editor.paragraph).first()).toContainText('quoted');
        expect(await getMarkdown(page)).toContain('> quoted');
    });

    test('slash menu creates a thematic break', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent(''));
        await page.locator(editor.paragraph).first().click();
        await page.keyboard.type('/');
        await page.locator(quickInsertItem('thematic-break')).click();
        await expect(page.locator(editor.thematicBreak).first()).toBeVisible();
    });

    test('typing "> " at the start of an empty paragraph converts to a block quote', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent(''));
        await page.locator(editor.paragraph).first().click();

        // `_convertToBlockQuote` (block/base/format.ts) fires from the inline
        // update pipeline once the text matches `(?:^|\n) {0,3}(>).+` — the
        // trailing space after ">" satisfies the `.+`.
        await slowType(page, '> ');

        const quote = page.locator(editor.blockQuote).first();
        await expect(quote).toBeVisible();

        // The conversion seeds the quote with a single empty paragraph.
        const blocks = await getBlocks(page);
        expect(blocks).toHaveLength(1);
        expect(blocks[0].name).toBe('block-quote');
        expect(blocks[0].children).toHaveLength(1);
        expect(blocks[0].children![0].name).toBe('paragraph');

        // Type into the freshly created quote paragraph and confirm round-trip.
        await slowType(page, 'a');
        await expect(quote.locator(editor.paragraph).first()).toContainText('a');
        expect(await getMarkdown(page)).toContain('> a');
    });

    test('Enter twice inside a block quote exits into a trailing paragraph', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent(''));
        await page.locator(editor.paragraph).first().click();
        await slowType(page, '> ');
        await expect(page.locator(editor.blockQuote).first()).toBeVisible();
        await slowType(page, 'a');

        // First Enter: the quote paragraph is non-empty, so a new empty
        // paragraph is appended *inside* the block quote. muya's enter handler
        // re-renders synchronously and re-seats the caret, so before issuing
        // the second Enter we wait for the live selection to settle on the new
        // empty quote paragraph — issuing the press too eagerly drops it.
        await page.keyboard.press('Enter');
        await expect(page.locator(editor.blockQuote).locator(editor.paragraph)).toHaveCount(2);
        await page.waitForFunction(() => {
            const sel = window.muya!.editor.selection.getSelection();
            const anchor = sel?.anchor?.block;
            return anchor != null
                && anchor.blockName === 'paragraph.content'
                && anchor.text === '';
        }, undefined, { timeout: 5000 });

        // Second Enter: the now-empty quote paragraph is the last child, so
        // `_enterInBlockQuote` lifts it out as a trailing top-level paragraph.
        await page.keyboard.press('Enter');

        // Exactly one block quote remains (the 'a' line) plus a trailing
        // paragraph. Poll the document state so the assertion auto-retries
        // until the synchronous re-render has fully settled.
        await expect.poll(async () => {
            const b = await getBlocks(page);
            return b.map(node => node.name);
        }).toEqual(['block-quote', 'paragraph']);

        const blocks = await getBlocks(page);
        expect(blocks[0].children).toHaveLength(1);
        expect(blocks[0].children![0].name).toBe('paragraph');
        expect(blocks[0].children![0].text).toBe('a');
        expect(blocks[1].text).toBe('');

        // The trailing paragraph lives outside the block quote in the DOM.
        await expect(page.locator(editor.blockQuote)).toHaveCount(1);
        await expect(page.locator(editor.blockQuote).locator(editor.paragraph)).toHaveCount(1);
        await expect(page.locator(editor.paragraph)).toHaveCount(2);

        // The caret has moved into the trailing paragraph content block.
        const anchorName = await page.evaluate(
            () => window.muya!.editor.selection.getSelection()?.anchor?.block?.blockName ?? null,
        );
        expect(anchorName).toBe('paragraph.content');

        expect(await getMarkdown(page)).toContain('> a');
    });

    test('typing "> > " nests a block quote inside a block quote', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent(''));
        await page.locator(editor.paragraph).first().click();

        // First "> " makes the outer quote; the second "> " typed into its
        // empty paragraph re-triggers the conversion and nests another quote.
        await slowType(page, '> ');
        await expect(page.locator(editor.blockQuote).first()).toBeVisible();
        await slowType(page, '> ');

        await expect(page.locator(editor.blockQuote)).toHaveCount(2);

        const blocks = await getBlocks(page);
        expect(blocks).toHaveLength(1);
        expect(blocks[0].name).toBe('block-quote');
        expect(blocks[0].children).toHaveLength(1);
        expect(blocks[0].children![0].name).toBe('block-quote');
        expect(blocks[0].children![0].children).toHaveLength(1);
        expect(blocks[0].children![0].children![0].name).toBe('paragraph');

        expect(await getMarkdown(page)).toContain('> > ');
    });
});
