import { expect, test } from '../fixtures/muya';
import { editor } from '../helpers/selectors';

test.describe('same-line display math (#4904)', () => {
    test('uses a full-width centered preview without changing the editing layout', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent('$$E=mc^2$$'));

        const wrapper = page.locator(editor.displayMath).first();
        const formula = wrapper.locator(editor.katex).first();
        await expect(formula).toBeVisible();

        const layout = await wrapper.evaluate((wrapper, selectors) => {
            const paragraph = wrapper.closest(selectors.paragraph)!;
            const formula = wrapper.querySelector(selectors.katex)!;
            const wrapperRect = wrapper.getBoundingClientRect();
            const paragraphRect = paragraph.getBoundingClientRect();
            const formulaRect = formula.getBoundingClientRect();

            return {
                display: getComputedStyle(wrapper).display,
                wrapperWidth: wrapperRect.width,
                paragraphWidth: paragraphRect.width,
                formulaCenter: formulaRect.left + formulaRect.width / 2,
                paragraphCenter: paragraphRect.left + paragraphRect.width / 2,
            };
        }, { paragraph: editor.paragraph, katex: editor.katex });

        expect(layout.display).toBe('block');
        expect(Math.abs(layout.wrapperWidth - layout.paragraphWidth)).toBeLessThanOrEqual(2);
        expect(Math.abs(layout.formulaCenter - layout.paragraphCenter)).toBeLessThanOrEqual(2);

        await wrapper.locator(editor.mathRender).click();
        await expect(wrapper).not.toHaveClass(/mu-hide/);
        expect(await wrapper.evaluate(element => getComputedStyle(element).display)).toBe('inline-block');
    });

    test('breaks surrounding sentence text around the display formula', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent('Energy is $$E=mc^2$$ conserved.'));

        const formula = page.locator(`${editor.displayMath} .katex`).first();
        await expect(formula).toBeVisible();

        const layout = await page.locator(editor.displayMath).evaluate((wrapper, paragraphSelector) => {
            const paragraph = wrapper.closest(paragraphSelector)!;
            const textRects = new Map<string, DOMRect>();
            const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
            let node: Node | null;

            while ((node = walker.nextNode())) {
                const value = node.textContent ?? '';
                for (const text of ['Energy is ', ' conserved.']) {
                    const index = value.indexOf(text);
                    if (index >= 0) {
                        const range = document.createRange();
                        range.setStart(node, index);
                        range.setEnd(node, index + text.length);
                        textRects.set(text, range.getBoundingClientRect());
                    }
                }
            }

            const wrapperRect = wrapper.getBoundingClientRect();
            const beforeRect = textRects.get('Energy is ')!;
            const afterRect = textRects.get(' conserved.')!;

            return {
                beforeBottom: beforeRect.bottom,
                formulaTop: wrapperRect.top,
                formulaBottom: wrapperRect.bottom,
                afterTop: afterRect.top,
            };
        }, editor.paragraph);

        expect(layout.beforeBottom).toBeLessThanOrEqual(layout.formulaTop + 1);
        expect(layout.afterTop).toBeGreaterThanOrEqual(layout.formulaBottom - 1);
    });
});
