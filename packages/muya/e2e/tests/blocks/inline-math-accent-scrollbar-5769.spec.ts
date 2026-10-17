import { expect, test } from '../fixtures/muya';

for (const fontSize of [14, 16, 20, 24]) {
    test(`inline accents do not create scrollbars at ${fontSize}px (#5769)`, async ({ page }) => {
        await page.evaluate((size) => {
            window.muya!.setOptions({ fontSize: size });
            window.muya!.setContent('1. The test of `$\\hat{y}$`: $\\hat{y}$\n2. The test of `$y$`: $y$\n3. $\\hat{x}$ $\\bar{y}$ $\\tilde{y}$ $\\vec{y}$ $\\widehat{xy}$');
        }, fontSize);
        const renders = page.locator('.mu-hide.mu-math > .mu-math-render');
        await expect(renders).toHaveCount(7);
        await page.evaluate(() => document.fonts.ready);

        for (const render of await renders.all()) {
            await expect(render.locator('.katex')).toBeVisible();
            expect(await render.evaluate(el => el.scrollWidth - el.clientWidth)).toBe(0);
        }
    });
}
