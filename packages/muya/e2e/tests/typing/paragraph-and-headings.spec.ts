import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { slowType } from '../helpers/keyboard';
import { editor, floats, quickInsertItem } from '../helpers/selectors';

test.describe('paragraphs and headings', () => {
    test('typing in a paragraph reflects in getMarkdown', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent('hello'));
        const para = page.locator(editor.paragraph).first();
        await para.click();
        await page.keyboard.press('End');
        await slowType(page, ' world');
        await expect(para).toContainText('hello world');
        expect(await getMarkdown(page)).toContain('hello world');
    });

    test('slash menu converts an empty paragraph to atx-heading level 1', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent(''));
        await page.locator(editor.paragraph).first().click();
        await page.keyboard.type('/');
        await expect(page.locator(floats.quickInsert)).toBeVisible();
        await page.locator(quickInsertItem('atx-heading 1')).click();
        await expect(page.locator(editor.atxHeading).first()).toBeVisible();
    });

    test('setContent with a setext heading renders correctly', async ({ page }) => {
        await page.evaluate(() => {
            window.muya!.setContent([{
                name: 'setext-heading',
                meta: { level: 1, underline: '===' },
                text: 'Setext Title',
            }] as unknown as Parameters<NonNullable<typeof window.muya>['setContent']>[0]);
        });
        await expect(page.locator(editor.setextHeading).first()).toBeVisible();
        expect(await getMarkdown(page)).toContain('Setext Title');
    });

    // ATX shortcut: typing `#`..`######` + a space at the start of an empty
    // paragraph converts it to an atx-heading of the matching level. The level
    // is taken from the hash count (`_convertToAtxHeading` in
    // packages/muya/src/block/base/format.ts), and the heading renders as an
    // `h{level}` element carrying `.mu-atx-heading`.
    for (const { hashes, level } of [
        { hashes: '####', level: 4 },
        { hashes: '#####', level: 5 },
        { hashes: '######', level: 6 },
    ]) {
        test(`typing '${hashes} ' converts an empty paragraph to atx-heading level ${level}`, async ({ page }) => {
            await page.evaluate(() => window.muya!.setContent(''));
            await page.locator(editor.paragraph).first().click();
            await slowType(page, `${hashes} Title`);

            const heading = page.locator(editor.atxHeading).first();
            await expect(heading).toBeVisible();
            // The heading tag reflects the level (h4 / h5 / h6).
            await expect(heading).toHaveJSProperty('tagName', `H${level}`);
            // No paragraph remains.
            await expect(page.locator(editor.paragraph)).toHaveCount(0);
            // Markdown round-trips with the right number of leading hashes.
            expect(await getMarkdown(page)).toContain(`${hashes} Title`);
        });
    }

    // The ATX regex caps at six hashes (`#{1,6}` with a whitespace/end
    // lookahead). Seven hashes followed by text never satisfies the lookahead,
    // so the block stays a plain paragraph rather than becoming a heading.
    test('typing 7 hashes does NOT convert to a heading (stays a paragraph)', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent(''));
        await page.locator(editor.paragraph).first().click();
        await slowType(page, '####### x');

        await expect(page.locator(editor.paragraph).first()).toBeVisible();
        await expect(page.locator(editor.atxHeading)).toHaveCount(0);
        expect(await getMarkdown(page)).toContain('####### x');
    });

    // Shift+Enter inserts a soft line break inside a single paragraph: the text
    // becomes `a\nb` (one paragraph, one `.mu-soft-line-break` span), and the
    // markdown carries the embedded newline. NOTE: the engine emits a plain
    // soft break (`\n`), not a CommonMark hard break (`  \n` / `\\\n`) — see
    // suspectedBugs. Backspace at the start of the second visual line removes
    // the soft break, joining the two lines back into `ab`.
    test('Shift+Enter inserts a soft line break, Backspace removes it', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent(''));
        await page.locator(editor.paragraph).first().click();

        await slowType(page, 'a');
        await page.keyboard.press('Shift+Enter');
        await slowType(page, 'b');

        // Stays one paragraph containing a soft-line-break span. The span wraps
        // a bare `\n` (zero-area inline box), so assert it is attached rather
        // than visible.
        await expect(page.locator(editor.paragraph)).toHaveCount(1);
        await expect(page.locator(editor.softLineBreak)).toHaveCount(1);
        await expect(page.locator(editor.softLineBreak).first()).toBeAttached();
        await page.waitForFunction(
            () => window.muya!.getMarkdown() === 'a\nb\n',
            undefined,
            { timeout: 5000 },
        );
        expect(await getMarkdown(page)).toBe('a\nb\n');

        // Move the caret to the start of the second visual line (before `b`) and
        // Backspace to delete the soft break, rejoining the lines into `ab`.
        await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('Backspace');

        await page.waitForFunction(
            () => window.muya!.getMarkdown() === 'ab\n',
            undefined,
            { timeout: 5000 },
        );
        expect(await getMarkdown(page)).toBe('ab\n');
        await expect(page.locator(editor.paragraph)).toHaveCount(1);
        await expect(page.locator(editor.softLineBreak)).toHaveCount(0);
    });
});
