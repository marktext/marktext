import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { editor, floats } from '../helpers/selectors';

const FOOTNOTE_BACKLINK = '.mu-footnote-backlink';

function fillerParagraphs(count: number): string {
    return Array.from({ length: count }, (_, i) => `Filler paragraph ${i + 1}.`).join('\n\n');
}

async function referenceInViewport(page: Page, identifier: string): Promise<boolean> {
    return page.evaluate((id) => {
        const reference = document.getElementById(`noteref-${id}`);
        if (!reference)
            return false;
        const { top, bottom } = reference.getBoundingClientRect();
        return top >= 0 && bottom <= window.innerHeight;
    }, identifier);
}

test.describe('footnote tool', () => {
    for (const identifier of ['锚点链接说明:1', 'a.b']) {
        test(`backlink returns to the reference [^${identifier}] (#5208)`, async ({ page }) => {
            const errors: string[] = [];
            page.on('pageerror', err => errors.push(String(err?.message ?? err)));

            await page.evaluate((md) => {
                window.muya!.setContent(md);
            }, `See note[^${identifier}].\n\n${fillerParagraphs(60)}\n\n[^${identifier}]: footnote body\n`);

            const backlink = page.locator(FOOTNOTE_BACKLINK);
            await backlink.scrollIntoViewIfNeeded();
            await expect.poll(() => referenceInViewport(page, identifier)).toBe(false);
            await backlink.click();

            await expect.poll(() => referenceInViewport(page, identifier)).toBe(true);
            expect(errors, `renderer pageerrors: ${errors.join(' | ')}`).toEqual([]);
        });
    }

    test('footnote tool previews a definition whose identifier contains a dot (#5208)', async ({ page }) => {
        await page.evaluate(() => {
            window.muya!.setContent('See note[^a.b].\n\n[^a.b]: dotted footnote body\n');
        });
        await page.locator(editor.inlineFootnoteIdentifier).first().click();
        await expect(page.locator(floats.footnoteTool)).toContainText('dotted footnote body');
    });

    test('footnote-tool float root is registered (option footnote: true)', async ({ page }) => {
        // host/main.ts wires `footnote: true`; the FootnoteTool plugin should
        // mount its baseFloat container at init.
        await expect(page.locator(floats.footnoteTool)).toHaveCount(1);
    });

    test('setContent with a footnote definition renders inline identifier', async ({ page }) => {
        await page.evaluate(() => {
            window.muya!.setContent('Some text[^a].\n\n[^a]: footnote body\n');
        });
        // The footnote identifier renders as `.mu-inline-footnote-identifier`.
        await expect(page.locator(editor.inlineFootnoteIdentifier).first()).toBeVisible();
    });
});
