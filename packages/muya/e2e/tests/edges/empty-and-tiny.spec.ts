import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { editor } from '../helpers/selectors';

/**
 * Edge inputs — degenerate documents and rapid mutation. Verifies the
 * editor doesn't crash, leaves the cursor in a sane place, and survives
 * back-to-back setContent calls without state corruption.
 */
test.describe('edges / empty and tiny documents', () => {
    test('setContent("") leaves a single empty paragraph and no crash', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent(''));

        // muya normalizes the empty input to one empty paragraph block.
        const state = await page.evaluate(() => window.muya!.getState() as Array<{ name: string; text?: string }>);
        expect(state.length).toBeGreaterThan(0);
        // The first block should be a paragraph with empty (or absent) text.
        expect(state[0].name).toBe('paragraph');
        expect((state[0].text ?? '').length).toBe(0);

        // A paragraph block is rendered in the DOM, and can be focused.
        await expect(page.locator(editor.paragraph).first()).toBeVisible();
        await page.locator(editor.paragraph).first().click();

        // Editor is alive: typing a single character lands in state.
        await page.keyboard.type('x');
        await expect(page.locator(editor.paragraph).first()).toContainText('x');
        const md = await getMarkdown(page);
        expect(md.trim()).toBe('x');
    });

    test('setContent("a") — single character round-trips and cursor is valid', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent('a'));

        const state = await page.evaluate(() => window.muya!.getState() as Array<{ name: string; text?: string }>);
        expect(state.length).toBe(1);
        expect(state[0].name).toBe('paragraph');
        expect(state[0].text).toBe('a');

        await expect(page.locator(editor.paragraph).first()).toContainText('a');
        await page.locator(editor.paragraph).first().click();

        // After clicking into the paragraph, document.getSelection() exposes
        // anchor/focus offsets — both should be a finite, non-negative number.
        const sel = await page.evaluate(() => {
            const s = window.getSelection();
            if (s == null)
                return null;
            return {
                anchorOffset: s.anchorOffset,
                focusOffset: s.focusOffset,
                isCollapsed: s.isCollapsed,
            };
        });
        expect(sel).not.toBeNull();
        expect(sel!.anchorOffset).toBeGreaterThanOrEqual(0);
        expect(sel!.focusOffset).toBeGreaterThanOrEqual(0);
        // Cursor lands at 0 or 1 (either end of the one-char content).
        expect(sel!.anchorOffset).toBeLessThanOrEqual(1);
    });

    test('10× rapid setContent without awaiting — final state matches the last call', async ({ page }) => {
        // All ten setContent calls happen in one synchronous JS turn — no
        // awaits, no microtask between them. The editor must end up in the
        // state of the last call with no leftover artifacts of the prior nine.
        await page.evaluate(() => {
            for (let i = 0; i < 10; i++)
                window.muya!.setContent(`# round ${i}`);
        });

        const md = await getMarkdown(page);
        expect(md.trim()).toBe('# round 9');

        const headings = await page.locator(editor.atxHeading).count();
        expect(headings).toBe(1);
        await expect(page.locator(editor.atxHeading).first()).toContainText('round 9');
    });
});
