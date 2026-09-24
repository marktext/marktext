import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';

const WIDE = 'C_{\\alpha} \\frac{d^{\\alpha} V_m}{dt^{\\alpha}} = I_{\\text{ext}} - \\bar{g}_{\\text{Na}} m^3 h (V_m - V_{\\text{Na}}) - \\bar{g}_{\\text{K}} n^4 (V_m - V_{\\text{K}}) - g_L (V_m - V_L) \\tag{A.13}';
const NARROW_VIEWPORT = { width: 520, height: 700 };
const WIDE_VIEWPORT = { width: 1100, height: 700 };

async function measure(page: Page, displaySelector: string) {
    return page.evaluate((selector) => {
        const display = document.querySelector(selector) as HTMLElement;
        const scroller = (display.closest('.mu-math-render') ?? display) as HTMLElement;
        const bases = [...display.querySelectorAll('.katex-html > .base')] as HTMLElement[];
        const tag = display.querySelector('.tag');
        const box = scroller.getBoundingClientRect();
        const first = bases[0]!.getBoundingClientRect();
        const last = bases[bases.length - 1]!.getBoundingClientRect();
        const tagBox = tag?.getBoundingClientRect();

        return {
            scrolls: scroller.scrollWidth > scroller.clientWidth,
            overlap: tagBox ? Math.round(last.right - tagBox.left) : null,
            tagWithinScrollExtent: tagBox ? tagBox.right - box.left <= scroller.scrollWidth + 1 : null,
            tagGapFromRightEdge: tagBox ? Math.abs(box.right - tagBox.right) : null,
            centreOffset: Math.abs((box.left + box.right) / 2 - (first.left + last.right) / 2),
        };
    }, displaySelector);
}

const BLOCK_DISPLAY = '.mu-math-preview .katex-display';
const SAME_LINE_DISPLAY = '.mu-math > .mu-math-render .katex-display';

async function setBlockFormula(page: Page, formula: string) {
    await page.evaluate(f => window.muya!.setContent(`$$\n${f}\n$$`), formula);
    await expect(page.locator(BLOCK_DISPLAY)).toBeVisible();
}

test('a math block wider than the column scrolls clear of its tag (#4339)', async ({ page }) => {
    await page.setViewportSize(NARROW_VIEWPORT);
    await setBlockFormula(page, WIDE);

    const math = await measure(page, BLOCK_DISPLAY);

    expect(math.scrolls).toBe(true);
    expect(math.overlap).toBeLessThanOrEqual(0);
    expect(math.tagWithinScrollExtent).toBe(true);
});

test('a math block that fits keeps its tag at the right margin (#4339)', async ({ page }) => {
    await page.setViewportSize(WIDE_VIEWPORT);
    await setBlockFormula(page, 'a + b = c \\tag{1}');

    const math = await measure(page, BLOCK_DISPLAY);

    expect(math.scrolls).toBe(false);
    expect(math.overlap).toBeLessThanOrEqual(0);
    expect(math.tagGapFromRightEdge).toBeLessThanOrEqual(1);
});

test('the preview floated under an active math block clears its tag too (#4339)', async ({ page }) => {
    await page.setViewportSize(NARROW_VIEWPORT);
    await setBlockFormula(page, WIDE);
    await page.locator('.mu-math-preview').click();
    await expect(page.locator('figure.mu-math-block.mu-active')).toBeVisible();

    const math = await measure(page, BLOCK_DISPLAY);

    expect(math.scrolls).toBe(true);
    expect(math.overlap).toBeLessThanOrEqual(0);
    expect(math.tagWithinScrollExtent).toBe(true);
});

test('an untagged math block stays centred (#4339)', async ({ page }) => {
    await page.setViewportSize(WIDE_VIEWPORT);
    await setBlockFormula(page, 'a + b = c');

    const math = await measure(page, BLOCK_DISPLAY);

    expect(math.centreOffset).toBeLessThanOrEqual(1);
});

for (const [label, viewport] of [['wider than', NARROW_VIEWPORT], ['narrower than', WIDE_VIEWPORT]] as const) {
    test(`same-line display math ${label} the column keeps its tag clear of the formula (#4339)`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.evaluate(f => window.muya!.setContent(`$$${f}$$`), WIDE);
        await expect(page.locator(SAME_LINE_DISPLAY)).toBeAttached();

        const math = await measure(page, SAME_LINE_DISPLAY);

        expect(math.overlap).toBeLessThanOrEqual(0);
        expect(math.tagWithinScrollExtent).toBe(true);
    });
}
