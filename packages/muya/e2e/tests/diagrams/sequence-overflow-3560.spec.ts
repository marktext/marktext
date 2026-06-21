import { expect, test } from '../fixtures/muya';
import { editor } from '../helpers/selectors';

// marktext #3560: a wide rendered sequence-diagram <svg> overflowed the block
// and was clipped. A `max-width: 100%` on the preview svg constrains it.
test('a rendered sequence diagram svg is width-constrained (#3560)', async ({ page }) => {
    await page.evaluate(() => {
        window.muya!.setContent([{
            name: 'diagram',
            text: 'Alice->Bob: a fairly long message here\nBob->Charlie: another long one\nCharlie->Alice: reply',
            meta: { lang: 'yaml', type: 'sequence' },
        }] as Parameters<typeof window.muya.setContent>[0]);
    });

    const svg = page.locator(`${editor.diagramPreview} > svg`).first();
    await expect(svg).toBeVisible({ timeout: 15_000 });

    const maxWidth = await svg.evaluate(el => getComputedStyle(el).maxWidth);
    expect(maxWidth).not.toBe('none');
});
