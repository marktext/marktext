import { expect, test } from '../fixtures/muya';

// marktext #4339: a long inline-math formula rendered a wide KaTeX popup that
// overflowed the editor horizontally. The popup must cap its width and scroll
// instead.
test('long inline math popup scrolls horizontally instead of overflowing (#4339)', async ({ page }) => {
    await page.evaluate(() => {
        window.muya!.setContent('$x_{1}+x_{2}+x_{3}+x_{4}+x_{5}+x_{6}+x_{7}+x_{8}+x_{9}+x_{10}+x_{11}+x_{12}+x_{13}+x_{14}$');
    });

    const render = page.locator('.mu-math > .mu-math-render').first();
    await expect(render).toBeAttached();

    const overflowX = await render.evaluate(el => getComputedStyle(el).overflowX);
    expect(overflowX).toBe('auto');
});
