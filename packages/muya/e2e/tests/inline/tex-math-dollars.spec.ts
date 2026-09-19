import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { editor } from '../helpers/selectors';

// #2002 / #5243: currency prose used to reach KaTeX. The tokenizer-level rules
// are pinned in src/inlineRenderer/__tests__/texMathDollars.spec.ts; what these
// cover is the editor a user actually looks at, where the symptom was reported.
test.describe('pandoc tex_math_dollars constraints (#5446)', () => {
    test('typing currency prose renders no formula', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent(''));
        await page.locator(editor.paragraph).first().click();
        await page.keyboard.type('Revenue rose from $13B to $24B.');

        // Poll first: muya batches its operations per frame, so the markdown
        // trails the last keystroke. Once it has caught up, any math the line
        // was going to produce has been rendered too.
        await expect
            .poll(() => getMarkdown(page))
            .toBe('Revenue rose from $13B to $24B.\n');
        await expect(page.locator(editor.katex)).toHaveCount(0);
    });

    test('a formula later on the line still renders, and only that one', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent('a $13B to $24B and $x+y$ b'));

        await expect(page.locator(editor.katex).first()).toBeVisible({ timeout: 10_000 });
        await expect(page.locator(editor.katex)).toHaveCount(1);
        await expect(page.locator(editor.katex).first()).toContainText('x+y');
    });
});
