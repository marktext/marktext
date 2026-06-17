import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { editor } from '../helpers/selectors';

/**
 * Text drag-selection must NOT auto-expand to whole structural blocks. A
 * selection whose anchor/focus lands inside a list item, code block, or table
 * cell used to grow to cover the entire list item / code block / table
 * (`TextSelection.handleMousemoveOrClick`). Expectation: the selection ends
 * exactly where the pointer lands — interior offsets stay interior.
 *
 * Real pointer drag → Chromium only (system Chrome locally / bundled in CI),
 * same constraint as the other `editing/` pointer specs.
 */

interface SelectionSnapshot {
    anchorText: string | null;
    focusText: string | null;
    anchorOffset: number | null;
    focusOffset: number | null;
}

async function readSelection(page: Page): Promise<SelectionSnapshot> {
    return page.evaluate(() => {
        const sel = window.muya!.editor.selection;
        return {
            anchorText: sel.anchorBlock?.text ?? null,
            focusText: sel.focusBlock?.text ?? null,
            anchorOffset: sel.anchor?.offset ?? null,
            focusOffset: sel.focus?.offset ?? null,
        };
    });
}

// Pixel centre of a single character in the nth matched paragraph, measured
// from a real DOM Range so the drag lands on an exact text offset (list-item
// paragraphs stretch full editor width, so a width-fraction would overshoot
// the rendered text).
async function pointAtChar(
    page: Page,
    selector: string,
    paragraphIndex: number,
    charOffset: number,
): Promise<{ x: number; y: number }> {
    return page.evaluate(
        ({ selector, paragraphIndex, charOffset }) => {
            const p = document.querySelectorAll(selector)[paragraphIndex] as HTMLElement;
            const textNode = document.createTreeWalker(p, NodeFilter.SHOW_TEXT).nextNode()!;
            const range = document.createRange();
            range.setStart(textNode, charOffset);
            range.setEnd(textNode, charOffset + 1);
            const r = range.getBoundingClientRect();
            return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        },
        { selector, paragraphIndex, charOffset },
    );
}

async function dragBetween(
    page: Page,
    from: { x: number; y: number },
    to: { x: number; y: number },
): Promise<void> {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
    await page.mouse.move(to.x, to.y, { steps: 4 });
    await page.mouse.up();
}

test.describe('text selection does not auto-expand blocks', () => {
    test('dragging between two list items keeps interior offsets', async ({ page }) => {
        await page.evaluate(() =>
            window.muya!.setContent('- first item here\n- second item here\n'));
        const sel = `${editor.bulletList} ${editor.paragraph}`;
        await expect(page.locator(sel)).toHaveCount(2);

        // Start at offset 12 of item 1, end at offset 3 of item 2 — both well
        // inside the rendered text. The old whole-item expansion snapped these
        // to 0 (anchor) and text.length (focus); without it they stay interior.
        await dragBetween(
            page,
            await pointAtChar(page, sel, 0, 12),
            await pointAtChar(page, sel, 1, 3),
        );

        await expect.poll(() => readSelection(page).then(s => s.focusText)).toBe('second item here');
        const snap = await readSelection(page);
        expect(snap.anchorText).toBe('first item here');
        // The whole-block expansion forced anchor→0 and focus→text.length.
        expect(snap.anchorOffset).toBeGreaterThan(0);
        expect(snap.anchorOffset).toBeLessThan('first item here'.length);
        expect(snap.focusOffset).toBeGreaterThan(0);
        expect(snap.focusOffset).toBeLessThan('second item here'.length);
    });
});
