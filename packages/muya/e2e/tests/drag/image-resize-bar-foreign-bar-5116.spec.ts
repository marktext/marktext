import type { Locator, Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { getMarkdown } from '../helpers/api';
import { editor, floats } from '../helpers/selectors';

const DATA_URI = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=';

// Document content that carries the resize handles' `bar` class: inline raw
// HTML, an HTML block and a mermaid node styled with `classDef bar`.
const HTML_BAR_MARKDOWN = `![alt](${DATA_URI})

Inline <span class="bar">progress bar</span> here.

<div class="bar">block bar</div>

End text.
`;

const MERMAID_BAR_MARKDOWN = `![alt](${DATA_URI})

\`\`\`mermaid
flowchart LR
  A[Start here]:::bar --> B[Finish]
  classDef bar fill:#f96
\`\`\`

End text.
`;

function collectErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(String(err?.message ?? err)));
    return errors;
}

async function loadMarkdown(page: Page, markdown: string): Promise<Locator> {
    await page.evaluate(md => window.muya!.setContent(md), markdown);
    const image = page.locator(editor.image).first();
    await expect.poll(() => image.evaluate(el => el.classList.contains('mu-image-success'))).toBe(true);
    const innerImg = image.locator('img').first();
    await expect(innerImg).toBeVisible();
    return innerImg;
}

async function dragAcross(page: Page, target: Locator) {
    const box = await target.boundingBox();
    if (!box)
        throw new Error('drag target has no bounding box');
    const x = box.x + Math.min(box.width / 2, 20);
    const y = box.y + box.height / 2;

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 40, y + 5, { steps: 4 });
    await page.mouse.move(x + 120, y + 30, { steps: 4 });
    await page.mouse.up();
    await page.waitForTimeout(200);
}

async function showAndHideResizeBar(page: Page, innerImg: Locator) {
    await innerImg.click();
    await expect(page.locator(floats.imageTransformerHandle)).toHaveCount(2);
    await page.getByText('End text.').click();
    await expect(page.locator(floats.imageTransformerHandle)).toHaveCount(0);
}

test.describe('ImageResizeBar ignores document content with class "bar" (#5116)', () => {
    test('drag-selecting over raw HTML with class "bar" does not crash', async ({ page }) => {
        const errors = collectErrors(page);
        await loadMarkdown(page, HTML_BAR_MARKDOWN);
        const before = await getMarkdown(page);

        await dragAcross(page, page.locator('span.mu-raw-html.bar'));
        await dragAcross(page, page.locator('.mu-html-preview div.bar'));

        expect(errors, `renderer pageerrors: ${errors.join(' | ')}`).toEqual([]);
        expect(await getMarkdown(page)).toBe(before);
    });

    test('drag-selecting over raw HTML with class "bar" after clicking an image keeps the image intact', async ({ page }) => {
        const errors = collectErrors(page);
        const innerImg = await loadMarkdown(page, HTML_BAR_MARKDOWN);
        const before = await getMarkdown(page);

        await showAndHideResizeBar(page, innerImg);
        await dragAcross(page, page.locator('span.mu-raw-html.bar'));

        const after = await getMarkdown(page);
        expect(after).not.toContain('NaN');
        expect(after).toBe(before);
        expect(errors, `renderer pageerrors: ${errors.join(' | ')}`).toEqual([]);
    });

    test('drag-selecting over raw HTML with class "bar" while the resize bar is shown does not resize the image', async ({ page }) => {
        const errors = collectErrors(page);
        const innerImg = await loadMarkdown(page, HTML_BAR_MARKDOWN);
        const before = await getMarkdown(page);

        await innerImg.click();
        await expect(page.locator(floats.imageTransformerHandle)).toHaveCount(2);
        await dragAcross(page, page.locator('span.mu-raw-html.bar'));

        const after = await getMarkdown(page);
        expect(after).not.toContain('NaN');
        expect(after).toBe(before);
        expect(errors, `renderer pageerrors: ${errors.join(' | ')}`).toEqual([]);
    });

    test('pressing a mermaid node with classDef "bar" after clicking an image keeps the image intact', async ({ page }) => {
        const errors = collectErrors(page);
        const innerImg = await loadMarkdown(page, MERMAID_BAR_MARKDOWN);
        // Press the label, not the node shape: the label is HTML inside the
        // node's <foreignObject>, and the resize bar ignores SVG targets.
        const label = page.locator(`${editor.diagramPreview} svg .node.bar .nodeLabel`).first();
        await expect(label).toBeVisible({ timeout: 15_000 });
        const before = await getMarkdown(page);

        await showAndHideResizeBar(page, innerImg);
        await dragAcross(page, label);

        const after = await getMarkdown(page);
        expect(after).not.toContain('NaN');
        expect(after).toBe(before);
        expect(errors, `renderer pageerrors: ${errors.join(' | ')}`).toEqual([]);
    });

    test('the bar\'s own handle still resizes the image', async ({ page }) => {
        const errors = collectErrors(page);
        const innerImg = await loadMarkdown(page, HTML_BAR_MARKDOWN);

        await innerImg.click();
        const rightHandle = page.locator(`${floats.imageTransformer} .bar.right`);
        await expect(rightHandle).toBeVisible();
        const box = await rightHandle.boundingBox();
        if (!box)
            throw new Error('right handle has no bounding box');
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;

        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + 40, y, { steps: 4 });
        await page.mouse.move(x + 80, y, { steps: 4 });
        await page.mouse.up();

        await expect.poll(() => getMarkdown(page)).toMatch(/<img [^>]*width="\d+"/);
        expect(errors, `renderer pageerrors: ${errors.join(' | ')}`).toEqual([]);
    });
});
