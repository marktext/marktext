import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { editor, floats, previewToolBarItem } from '../helpers/selectors';

async function hoverBlock(page: Page, selector: string): Promise<void> {
    const box = await page.locator(selector).first().boundingBox();
    if (!box)
        throw new Error(`no box for ${selector}`);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
}

async function toolbarOpacity(page: Page): Promise<number> {
    return page.locator(floats.previewToolBar).evaluate((el) => {
        const wrapper = el.closest('.mu-float-wrapper') as HTMLElement | null;
        return Number.parseFloat(wrapper?.style.opacity || '0');
    });
}

/** Distance from the toolbar's right edge to the block's right edge (px). */
async function rightEdgeGap(page: Page, blockSelector: string): Promise<number> {
    const toolbar = await page.locator(floats.previewToolBar).boundingBox();
    const block = await page.locator(blockSelector).first().boundingBox();
    if (!toolbar || !block)
        throw new Error('missing box');
    return block.x + block.width - (toolbar.x + toolbar.width);
}

async function showMathBlock(page: Page): Promise<void> {
    await page.evaluate(() => {
        window.muya!.setContent([{
            name: 'math-block',
            text: 'a \\ne b',
            meta: { mathStyle: '' },
        }] as unknown as Parameters<NonNullable<typeof window.muya>['setContent']>[0]);
    });
    await expect(page.locator(editor.katex).first()).toBeVisible({ timeout: 10_000 });
}

async function showMermaidBlock(page: Page): Promise<void> {
    await page.evaluate(() => {
        window.muya!.setContent([{
            name: 'diagram',
            text: 'graph TD\n    A-->B',
            meta: { lang: 'yaml', type: 'mermaid' },
        }] as unknown as Parameters<NonNullable<typeof window.muya>['setContent']>[0]);
    });
    await expect(page.locator(`${editor.diagramPreview} svg`).first())
        .toBeVisible({ timeout: 15_000 });
}

test.describe('preview toolbar', () => {
    test('hovering a math block shows the edit + delete actions', async ({ page }) => {
        await showMathBlock(page);
        await hoverBlock(page, editor.mathBlock);

        await expect.poll(() => toolbarOpacity(page), { timeout: 5_000 }).toBe(1);
        await expect(page.locator(`${floats.previewToolBar} li.item`)).toHaveCount(2);
    });

    test('the toolbar sits inside the block it belongs to', async ({ page }) => {
        await showMathBlock(page);
        await hoverBlock(page, editor.mathBlock);
        await expect.poll(() => toolbarOpacity(page), { timeout: 5_000 }).toBe(1);

        const gap = await rightEdgeGap(page, editor.mathBlock);
        expect(Math.abs(gap - 5)).toBeLessThanOrEqual(1);
    });
});

test.describe('preview toolbar — diagram blocks', () => {
    test('hovering a mermaid diagram adds a view action', async ({ page }) => {
        await showMermaidBlock(page);
        await hoverBlock(page, editor.diagramBlock);

        await expect.poll(() => toolbarOpacity(page), { timeout: 5_000 }).toBe(1);
        await expect(page.locator(`${floats.previewToolBar} li.item`)).toHaveCount(3);
        await expect(page.locator(previewToolBarItem('view'))).toHaveCount(1);
    });

    test('the wider toolbar still sits inside the block', async ({ page }) => {
        await showMermaidBlock(page);
        await hoverBlock(page, editor.diagramBlock);
        await expect.poll(() => toolbarOpacity(page), { timeout: 5_000 }).toBe(1);

        const gap = await rightEdgeGap(page, editor.diagramBlock);
        expect(Math.abs(gap - 5)).toBeLessThanOrEqual(1);
    });

    test('clicking view hands the host the rendered diagram', async ({ page }) => {
        await page.evaluate(() => {
            (window as unknown as { __diagrams: unknown[] }).__diagrams = [];
            window.muya!.on('preview-diagram', (payload: unknown) => {
                (window as unknown as { __diagrams: unknown[] }).__diagrams.push(payload);
            });
        });
        await showMermaidBlock(page);
        await hoverBlock(page, editor.diagramBlock);
        await expect.poll(() => toolbarOpacity(page), { timeout: 5_000 }).toBe(1);

        await page.locator(previewToolBarItem('view')).click();

        const emitted = await page.evaluate(() => {
            const [payload] = (window as unknown as {
                __diagrams: Array<{ type: string; code: string; preview: HTMLElement; label: string | null }>
            }).__diagrams;
            return payload
                ? {
                        type: payload.type,
                        code: payload.code,
                        previewClass: payload.preview.className,
                        svgCount: payload.preview.querySelectorAll('svg').length,
                        label: payload.label,
                    }
                : null;
        });

        expect(emitted).not.toBeNull();
        expect(emitted!.type).toBe('mermaid');
        expect(emitted!.code).toContain('graph TD');
        expect(emitted!.previewClass).toContain('mu-diagram-preview');
        expect(emitted!.svgCount).toBe(1);
        expect(emitted!.label).toBeTruthy();
    });

    test('a diagram that failed to render offers no view action', async ({ page }) => {
        await page.evaluate(() => {
            window.muya!.setContent([{
                name: 'diagram',
                text: 'graph TD\n    A--->',
                meta: { lang: 'yaml', type: 'mermaid' },
            }] as unknown as Parameters<NonNullable<typeof window.muya>['setContent']>[0]);
        });
        await expect(page.locator(editor.diagramError).first()).toBeVisible({ timeout: 15_000 });

        await hoverBlock(page, editor.diagramBlock);
        await expect.poll(() => toolbarOpacity(page), { timeout: 5_000 }).toBe(1);

        await expect(page.locator(`${floats.previewToolBar} li.item`)).toHaveCount(2);
        await expect(page.locator(previewToolBarItem('view'))).toHaveCount(0);
    });
});
