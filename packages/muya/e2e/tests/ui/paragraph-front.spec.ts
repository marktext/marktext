import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { editor, floats } from '../helpers/selectors';

/**
 * Hover the first paragraph so the `ParagraphFrontButton` positions its
 * handle over it (mousemove is throttled at 300 ms, so move twice with a tick
 * in between to guarantee the handler observes the latest cursor location —
 * same trick as drag/paragraph-reorder.spec.ts), then quick-click the handle.
 *
 * `ParagraphFrontButton`'s click handler emits the `muya-front-menu` event
 * carrying the hovered block; `ParagraphFrontMenu` subscribes and (after a
 * 0 ms timeout) shows + renders the menu. Resolving once the first
 * `.turn-into-item` is visible proves the menu rendered its submenu.
 */
async function openFrontMenu(page: Page): Promise<void> {
    const para = page.locator(editor.paragraph).first();
    const box = await para.boundingBox();
    if (!box)
        throw new Error('paragraph has no bounding box');

    await page.mouse.move(box.x + 10, box.y + box.height / 2);
    await page.waitForTimeout(50);
    await page.mouse.move(box.x + 12, box.y + box.height / 2);

    const wrapper = page.locator(floats.paragraphFrontButton);
    await expect.poll(async () => wrapper.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0
            && r.height > 0
            && Number.parseFloat((el as HTMLElement).style.opacity || '0') > 0;
    }), { timeout: 3_000 }).toBe(true);

    await page.locator(floats.paragraphFrontButtonInner).click();

    await expect(
        page.locator(`${floats.paragraphFrontMenu} .turn-into-item`).first(),
    ).toBeVisible({ timeout: 3_000 });
}

test.describe('paragraph front button + menu', () => {
    test('front-menu float root mounts after editor init', async ({ page }) => {
        // The front menu is a registered baseFloat plugin. Its container is
        // appended to the DOM at construction; we just assert it exists.
        await expect(page.locator(floats.paragraphFrontMenu)).toHaveCount(1);
    });

    test('front-button wrapper is mounted by the plugin', async ({ page }) => {
        // ParagraphFrontButton.init() appends a `.mu-front-button-wrapper` div
        // to document.body at construction. Whether or not it's positioned
        // over a paragraph depends on hover state — but the wrapper itself
        // must exist as soon as muya.init() completes.
        await expect(page.locator(floats.paragraphFrontButton)).toHaveCount(1);
    });

    test('hovering a paragraph positions the front button over it', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent('a paragraph'));
        const para = page.locator(editor.paragraph).first();
        const wrapper = page.locator(floats.paragraphFrontButton);

        await para.hover();
        // After hover, the plugin assigns a non-zero size to the wrapper
        // (init() sets width/height from the inner container via
        // ResizeObserver). A zero-sized wrapper means the plugin never picked
        // up the paragraph.
        await expect.poll(async () => {
            return wrapper.evaluate((el) => {
                const r = el.getBoundingClientRect();
                return r.width > 0 && r.height > 0;
            });
        }, { timeout: 3_000 }).toBe(true);
    });
});

test.describe('paragraph front menu — Turn Into', () => {
    test('Turn Into → Code Block converts an empty paragraph and round-trips', async ({ page }) => {
        // `canTurnIntoMenu` only offers code-block / diagram targets when the
        // paragraph is EMPTY (a non-empty paragraph is limited to
        // heading/quote/list — covered by the gating test below). Start from a
        // single empty paragraph so the Code Block entry is present.
        await page.evaluate(() => window.muya!.setContent([{ name: 'paragraph', text: '' }]));
        await openFrontMenu(page);

        // Submenu item selector is `div.turn-into-item.<label>` (label
        // `code-block`).
        await page
            .locator(`${floats.paragraphFrontMenu} .turn-into-item.code-block`)
            .click();

        // The paragraph is replaced in place by a fenced code block
        // (`mu-code-block` — block/commonMark/codeBlock sets this classList),
        // wrapping the `.mu-codeblock-content` editor surface. NB: this engine
        // does not emit `.mu-fence-code` (editor.fenceCode is a legacy alias).
        await expect(page.locator(editor.codeBlock).first()).toBeVisible({ timeout: 3_000 });
        await expect(
            page.locator(`${editor.codeBlock} ${editor.codeContent}`).first(),
        ).toBeVisible();
        // replaceBlockByLabel swaps the block out, so no paragraph survives.
        await expect(page.locator(editor.paragraph)).toHaveCount(0);

        // Empty fenced code block round-trips to a bare ``` fence pair.
        const md = await getMarkdown(page);
        expect(md).toBe('```\n\n```\n');
    });

    test('Turn Into → Mermaid converts an empty paragraph to a diagram block and round-trips', async ({ page }) => {
        await page.evaluate(() => window.muya!.setContent([{ name: 'paragraph', text: '' }]));
        await openFrontMenu(page);

        // Label is `diagram mermaid`; the space becomes two classes
        // (`turn-into-item diagram mermaid`).
        await page
            .locator(`${floats.paragraphFrontMenu} .turn-into-item.diagram.mermaid`)
            .click();

        // Diagram block mounts its container + preview surface
        // (block/extra/diagram sets `mu-diagram-block`).
        await expect(page.locator(editor.diagramBlock).first()).toBeVisible({ timeout: 3_000 });
        await expect(page.locator(editor.diagramContainer).first()).toBeVisible();
        await expect(page.locator(editor.diagramPreview).first()).toBeVisible();
        await expect(page.locator(editor.paragraph)).toHaveCount(0);

        // Empty mermaid diagram round-trips to a ```mermaid fence.
        const md = await getMarkdown(page);
        expect(md).toBe('```mermaid\n\n```\n');
    });

    test('Turn Into menu gates code-block/diagram to EMPTY paragraphs only', async ({ page }) => {
        // A non-empty paragraph's Turn-Into submenu is restricted by
        // `canTurnIntoMenu`'s PARAGRAPH_TURN_INTO_REG to
        // paragraph/heading/quote/lists — code-block and diagram entries are
        // absent. This is the gating contract that justifies starting the two
        // conversion tests above from an empty paragraph.
        await page.evaluate(() => window.muya!.setContent('hello world'));
        await openFrontMenu(page);

        const menu = floats.paragraphFrontMenu;
        await expect(page.locator(`${menu} .turn-into-item.code-block`)).toHaveCount(0);
        await expect(page.locator(`${menu} .turn-into-item.diagram.mermaid`)).toHaveCount(0);
        // Block-quote IS an allowed target for a non-empty paragraph.
        await expect(page.locator(`${menu} .turn-into-item.block-quote`)).toHaveCount(1);
    });
});
