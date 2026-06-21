import { expect, test } from '../fixtures/muya';

// marktext #4100: an invalid inline-math formula renders a KaTeX parse-error
// message inside the narrow inline-math popup; without `white-space: nowrap`
// the message wrapped across several lines and overflowed.
test('invalid inline math error message stays on one line (#4100)', async ({ page }) => {
    await page.evaluate(() => window.muya!.setContent('inline $\\g$ math'));

    const err = page.locator('.mu-math-error').first();
    await expect(err).toBeAttached();

    const whiteSpace = await err.evaluate(el => getComputedStyle(el).whiteSpace);
    expect(whiteSpace).toBe('nowrap');
});
