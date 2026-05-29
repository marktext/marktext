import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { editor, floats } from '../helpers/selectors';

/**
 * Paragraph front-button block reorder.
 *
 * `ParagraphFrontButton.dragBarMouseDown` arms drag via a 300 ms timer;
 * `startDrag` then attaches a document-level mousemove (throttled to 100 ms)
 * + mouseup. `mouseUp` (note the camel-case — it's the document handler,
 * not the bar's own `dragBarMouseUp`) commits the reorder by calling
 * `block.insertInto(parent, target | target.next)` based on whether the
 * cursor is in the top or bottom half of the target block at release.
 *
 * Contract under test: drag paragraph A's front handle to a position
 * below paragraph B → `getMarkdown()` returns the paragraphs in swapped
 * order.
 */

test.describe('ParagraphFrontButton block reorder', () => {
    test('dragging paragraph A below paragraph B swaps their markdown order', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent('PARA-A\n\nPARA-B'));

        const paraA = page.locator(editor.paragraph).nth(0);
        const paraB = page.locator(editor.paragraph).nth(1);
        await expect(paraA).toContainText('PARA-A');
        await expect(paraB).toContainText('PARA-B');

        const initialMd = await getMarkdown(page);
        expect(initialMd.indexOf('PARA-A')).toBeLessThan(initialMd.indexOf('PARA-B'));

        // Hover paragraph A so the front button positions over it. The
        // button's mousemove handler is throttled at 300 ms, so move
        // twice with a tick in between to guarantee the handler observes
        // the latest cursor location.
        const aBox = await paraA.boundingBox();
        const bBox = await paraB.boundingBox();
        if (!aBox || !bBox)
            throw new Error('paragraphs have no bounding box');

        await page.mouse.move(aBox.x + 10, aBox.y + aBox.height / 2);
        await page.waitForTimeout(50);
        await page.mouse.move(aBox.x + 12, aBox.y + aBox.height / 2);

        const frontWrapper = page.locator(floats.paragraphFrontButton);
        await expect.poll(async () => frontWrapper.evaluate((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0
                && Number.parseFloat((el as HTMLElement).style.opacity || '0') > 0;
        }), { timeout: 3_000 }).toBe(true);

        const handleBox = await frontWrapper.boundingBox();
        if (!handleBox)
            throw new Error('front button wrapper has no bounding box');

        // Mousedown on the handle and hold past the 300 ms arming threshold
        // so `startDrag` fires.
        await page.mouse.move(
            handleBox.x + handleBox.width / 2,
            handleBox.y + handleBox.height / 2,
        );
        await page.mouse.down();
        await page.waitForTimeout(400);

        // Drag below paragraph B (Y past B's vertical midpoint puts the
        // drop indicator in B's bottom half, i.e. position === 'down').
        // Intermediate moves so the throttled-at-100ms mousemove handler
        // sees motion on every engine.
        const targetY = bBox.y + bBox.height * 0.75;
        const targetX = bBox.x + 20;
        await page.mouse.move(targetX, (handleBox.y + targetY) / 2, { steps: 4 });
        await page.waitForTimeout(120);
        await page.mouse.move(targetX, targetY, { steps: 6 });
        await page.waitForTimeout(150);
        await page.mouse.up();

        // Verify the swap landed in state. There's no setTimeout in the
        // mouseUp commit path, but poll anyway because snabbdom patches
        // run on a microtask.
        await expect.poll(async () => {
            const md = await getMarkdown(page);
            return md.indexOf('PARA-B') < md.indexOf('PARA-A');
        }, { timeout: 5_000, intervals: [50, 100, 250, 500] }).toBe(true);

        const finalMd = await getMarkdown(page);
        expect(finalMd).toContain('PARA-A');
        expect(finalMd).toContain('PARA-B');
    });
});
