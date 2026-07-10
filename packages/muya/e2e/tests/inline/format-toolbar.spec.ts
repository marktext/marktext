import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { editor, floats } from '../helpers/selectors';

async function selectAllOfFirstParagraph(page: Page) {
    const para = page.locator(editor.paragraph).first();
    // Triple-click to select the full paragraph text — this is the standard
    // browser gesture that fires selectionchange so the IFT pops up.
    await para.click({ clickCount: 3 });
    return para;
}

// Inline strong markers (`**`) are rendered as `span.mu-remove` sibling nodes
// either side of the `<strong.mu-inline-rule>` run. Source of truth:
// packages/muya/src/inlineRenderer/renderer/delEmStrongFactory.ts builds
// `span.${className}.mu-remove` where className comes from
// Renderer#getClassName: when the caret is OUTSIDE the token the markers get
// `mu-hide` (collapsed); when the caret is INSIDE (checkConflicted true) they
// get `mu-gray` (revealed). `.mu-remove` is stable across both states, so we
// scope to it and assert the mu-hide/mu-gray toggle.
const strongMarker = `${editor.paragraph} span.mu-remove`;
const strongMarkerHidden = `${editor.paragraph} span.mu-remove.mu-hide`;
const strongMarkerGray = `${editor.paragraph} span.mu-remove.mu-gray`;

test.describe('inline format toolbar', () => {
    test('appears on text selection', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent('hello world'));
        await selectAllOfFirstParagraph(page);
        await expect(page.locator(floats.inlineFormatToolbar)).toBeVisible();
    });

    test('clicking the strong button wraps the selection in **bold**', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent('hello world'));
        await selectAllOfFirstParagraph(page);
        await expect(page.locator(floats.inlineFormatToolbar)).toBeVisible();
        await page.locator(`${floats.inlineFormatToolbar} li.item.strong`).click();
        const md = await getMarkdown(page);
        expect(md).toContain('**hello world**');
    });

    test('clicking the em button wraps the selection in *italic*', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent('alpha'));
        await selectAllOfFirstParagraph(page);
        await page.locator(`${floats.inlineFormatToolbar} li.item.em`).click();
        const md = await getMarkdown(page);
        expect(md).toMatch(/[*_]alpha[*_]/);
    });

    test('strong run renders with collapsed (mu-hide) markers when the caret is outside', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent('a **bold** b'));
        // Click at the very start of the paragraph so the caret sits OUTSIDE
        // the strong token; the markers should collapse to `.mu-hide`.
        await page.locator(editor.paragraph).first().click({ position: { x: 2, y: 2 } });

        const strongRun = page.locator(`${editor.paragraph} strong.mu-inline-rule`);
        await expect(strongRun).toHaveCount(1);
        await expect(strongRun).toHaveText('bold');

        // Two `**` marker spans, both collapsed via `.mu-hide`, none revealed.
        await expect(page.locator(strongMarker)).toHaveCount(2);
        await expect(page.locator(strongMarkerHidden)).toHaveCount(2);
        await expect(page.locator(strongMarkerGray)).toHaveCount(0);

        expect(await getMarkdown(page)).toContain('**bold**');
    });

    test('mu-hide toggles off the **markers as the caret enters the strong run, and back on as it leaves', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent('a **bold** b'));

        // 1) Caret outside the strong run → both markers carry `.mu-hide`.
        await page.locator(editor.paragraph).first().click({ position: { x: 2, y: 2 } });
        await expect(page.locator(strongMarkerHidden)).toHaveCount(2);
        await expect(page.locator(strongMarkerGray)).toHaveCount(0);

        // 2) Move the caret INTO the strong run by clicking the rendered word.
        //    The markers re-render WITHOUT `.mu-hide` (they become `.mu-gray`,
        //    i.e. revealed) — this is the toggle the inline renderer performs
        //    via Renderer#getClassName + checkConflicted.
        await page.locator(`${editor.paragraph} strong.mu-inline-rule`).click();
        await expect(page.locator(strongMarkerHidden)).toHaveCount(0);
        await expect(page.locator(strongMarkerGray)).toHaveCount(2);

        // 3) Move the caret back OUT → `.mu-hide` returns on both markers.
        await page.locator(editor.paragraph).first().click({ position: { x: 2, y: 2 } });
        await expect(page.locator(strongMarkerHidden)).toHaveCount(2);
        await expect(page.locator(strongMarkerGray)).toHaveCount(0);
    });
});
