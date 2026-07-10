import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { editor } from '../helpers/selectors';

test.describe('math and diagrams', () => {
    test('typing $$ + Enter converts paragraph to a math block', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent(''));
        await page.locator(editor.paragraph).first().click();
        await page.keyboard.type('$$');
        await page.keyboard.press('Enter');
        await expect(page.locator(editor.mathBlock).first()).toBeVisible();
    });

    test('math block renders KaTeX after typing a formula', async ({ page }) => {
        await page.evaluate(() => {
            window.muya!.setContent([{
                name: 'math-block',
                text: 'a \\ne b',
                meta: { mathStyle: '' },
            }] as unknown as Parameters<NonNullable<typeof window.muya>['setContent']>[0]);
        });
        // KaTeX renders asynchronously into .mu-math-render; wait for it.
        await expect(page.locator(editor.katex).first()).toBeVisible({ timeout: 10_000 });
        expect(await getMarkdown(page)).toContain('a \\ne b');
    });

    test('mermaid diagram block renders SVG', async ({ page }) => {
        await page.evaluate(() => {
            window.muya!.setContent([{
                name: 'diagram',
                text: 'graph TD\n    A-->B',
                meta: { lang: 'yaml', type: 'mermaid' },
            }] as unknown as Parameters<NonNullable<typeof window.muya>['setContent']>[0]);
        });
        // Mermaid is async; allow up to 15s for the SVG to mount inside the
        // diagram preview.
        await expect(page.locator(`${editor.diagramPreview} svg`).first())
            .toBeVisible({ timeout: 15_000 });
    });

    test('inline $x^2$ renders KaTeX inside the paragraph and round-trips', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent('inline $x^2$ math'));

        // The inline math wrapper lives inside the paragraph (not a math
        // block) and KaTeX renders asynchronously into .mu-math-render.
        const mathRender = page.locator(`${editor.paragraph} ${editor.mathRender}`).first();
        await expect(mathRender).toBeVisible();
        await expect(page.locator(`${editor.paragraph} ${editor.katex}`).first())
            .toBeVisible({ timeout: 10_000 });

        await expect(page.locator(editor.katex)).toHaveCount(1);

        // The source markdown round-trips losslessly through the serializer.
        expect(await getMarkdown(page)).toContain('$x^2$');
    });

    test('clicking the rendered inline KaTeX activates the source for editing', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent('inline $x^2$ math'));
        await expect(page.locator(`${editor.paragraph} ${editor.katex}`).first())
            .toBeVisible({ timeout: 10_000 });

        const mathWrapper = page.locator(editor.inlineMath).first();

        // Before clicking: the caret is outside the inline-math token, so the
        // wrapper carries `mu-hide` — the KaTeX preview shows and the raw
        // `$x^2$` source span is collapsed.
        await expect(mathWrapper).toHaveClass(/mu-hide/);

        // Clicking the rendered KaTeX runs `_handleClickInlineRuleRender`,
        // which `setCursor`s across the math source range read from the
        // preview's data-start/data-end. That re-renders the token with the
        // caret *inside* it, dropping the `mu-hide` class and revealing the
        // editable `.mu-math-text` source span.
        await page.locator(`${editor.mathRender} ${editor.katex}`).first().click();
        await expect(mathWrapper).not.toHaveClass(/mu-hide/);
        await expect(page.locator(editor.inlineMathText).first()).toBeVisible();

        // The selection now spans the math source text (the `x^2` between the
        // `$` markers, offsets 8..11 of `inline $x^2$ math`) and is anchored
        // in the inline paragraph content block — not collapsed and not a
        // separate math block.
        const selection = await page.evaluate(() => {
            const sel = window.muya!.editor.selection.getSelection();
            if (!sel)
                return null;
            return {
                anchorOffset: sel.anchor.offset,
                focusOffset: sel.focus.offset,
                anchorBlockName: sel.anchor.block.blockName,
            };
        });
        expect(selection).not.toBeNull();
        expect(selection!.anchorOffset).toBe(8);
        expect(selection!.focusOffset).toBe(11);
        expect(selection!.anchorBlockName).toBe('paragraph.content');

        // The source still round-trips after the click activated edit mode.
        expect(await getMarkdown(page)).toContain('$x^2$');
    });
});
