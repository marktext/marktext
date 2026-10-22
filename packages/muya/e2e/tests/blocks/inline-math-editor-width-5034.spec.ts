import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';

// marktext #5034: the Max width preference stores a percentage, which reaches
// muya as `--editor-area-width: calc(100px + 80%)`. `.mu-math-render` used to
// derive its cap from that variable, and its containing block is the inline
// `.mu-math` around the formula — so the percentage resolved against the
// formula's own box: `$a+b$` came out clipped, with a scrollbar under it, while
// a long formula lost its cap entirely and ran past the editor.

const LONG_FORMULA = `$${Array.from({ length: 40 }, (_, i) => `x_{${i}}`).join('+')}$`;

/** Mirror what marktext's `setEditorWidth()` injects for a preference value. */
async function setMaxWidthPreference(page: Page, value: string | null) {
    await page.evaluate((v) => {
        const ID = 'editor-width';
        let style = document.querySelector(`#${ID}`) as HTMLStyleElement | null;
        if (!style) {
            style = document.createElement('style');
            style.id = ID;
            document.head.appendChild(style);
        }
        style.innerHTML = v
            ? `:root { --editorAreaWidth: calc(100px + ${v}); --editor-area-width: calc(100px + ${v}); }`
            : '';
    }, value);
}

async function measureRender(page: Page) {
    return page.evaluate(() => {
        const render = document.querySelector('.mu-math-render') as HTMLElement;
        const block = render.closest('p, li, blockquote') as HTMLElement;
        return {
            hiddenState: render.closest('.mu-math')!.classList.contains('mu-hide'),
            overflow: render.scrollWidth - render.clientWidth,
            right: Math.round(render.getBoundingClientRect().right),
            blockRight: Math.round(block.getBoundingClientRect().right),
        };
    });
}

for (const maxWidth of [null, '100%', '80%', '800px']) {
    const label = maxWidth ?? 'unset';

    test(`a short inline formula is never clipped with Max width ${label} (#5034)`, async ({ page }) => {
        await setMaxWidthPreference(page, maxWidth);
        await page.evaluate(() => window.muya!.setContent('Inline formula: $a+b$'));
        await expect(page.locator('.mu-math-render .katex')).toBeVisible();

        const render = await measureRender(page);
        expect(render.hiddenState).toBe(true);
        expect(render.overflow).toBe(0);
    });

    test(`a long inline formula scrolls instead of leaving the column with Max width ${label} (#4339, #5034)`, async ({ page }) => {
        await setMaxWidthPreference(page, maxWidth);
        await page.evaluate(m => window.muya!.setContent(`text ${m} end`), LONG_FORMULA);
        await expect(page.locator('.mu-math-render .katex')).toBeVisible();

        const render = await measureRender(page);
        expect(render.overflow).toBeGreaterThan(0);
        expect(render.right).toBeLessThanOrEqual(render.blockRight);
    });
}

test('a quoted formula is bound by the quote, not by the editor column (#5034)', async ({ page }) => {
    await page.evaluate(m => window.muya!.setContent(`> text ${m} end`), LONG_FORMULA);
    await expect(page.locator('.mu-math-render .katex')).toBeVisible();

    const render = await measureRender(page);
    expect(render.right).toBeLessThanOrEqual(render.blockRight);
});

test('the popup shown while editing a short formula is not clipped either (#5034)', async ({ page }) => {
    await setMaxWidthPreference(page, '80%');
    await page.evaluate(() => window.muya!.setContent('Inline formula: $a+b$'));
    await expect(page.locator('.mu-math-render .katex')).toBeVisible();
    await page.locator('.mu-math-render').first().click();
    await expect(page.locator('.mu-math:not(.mu-hide) > .mu-math-render')).toBeVisible();

    const render = await measureRender(page);
    expect(render.hiddenState).toBe(false);
    expect(render.overflow).toBe(0);
});
