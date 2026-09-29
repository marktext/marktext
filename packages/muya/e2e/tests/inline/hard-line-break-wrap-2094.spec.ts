import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/muya';
import { editor } from '../helpers/selectors';

const TEXT = 'AAAA BBBB CCCC DDDD EEEE FFFF GGGG HHHH';
const MARKDOWN = `${TEXT}  \nsecond\n\n${TEXT}\nsecond\n`;
const WIDTHS = { from: 360, to: 760 };

interface IWidthRow {
    width: number;
    lines: number;
    controlLines: number;
    glyphLines: number;
}

async function measureAcrossWidths(page: Page): Promise<IWidthRow[]> {
    return page.evaluate(({ selectors, widths }) => {
        const root = document.querySelector<HTMLElement>(selectors.container)!;
        const [hard, control] = [...document.querySelectorAll<HTMLElement>(selectors.paragraph)]
            .map(paragraph => paragraph.querySelector<HTMLElement>(selectors.paragraphContent)!);
        const spaces = hard.querySelector<HTMLElement>(selectors.hardLineBreakSpace)!;
        const lineHeight = Number.parseFloat(globalThis.getComputedStyle(hard).lineHeight);
        const lines = (element: HTMLElement) => Math.round(element.getBoundingClientRect().height / lineHeight);
        const rows = [];

        for (let width = widths.from; width <= widths.to; width++) {
            root.style.width = `${width}px`;
            rows.push({
                width,
                lines: lines(hard),
                controlLines: lines(control),
                glyphLines: new Set([...spaces.getClientRects()].map(rect => Math.round(rect.top))).size,
            });
        }
        root.style.width = '';

        return rows;
    }, { selectors: editor, widths: WIDTHS });
}

test.describe('a hard line break glyph near the right margin (#2094)', () => {
    test.beforeEach(async ({ page }) => {
        await page.evaluate(markdown => window.muya!.setContent(markdown), MARKDOWN);
        await expect(page.locator(editor.hardLineBreakSpace)).toHaveCount(1);
    });

    test('never adds a line the same text with a soft break does not need', async ({ page }) => {
        const rows = await measureAcrossWidths(page);

        expect(new Set(rows.map(row => row.controlLines)).size).toBeGreaterThan(1);
        expect(rows.filter(row => row.lines !== row.controlLines).map(row => row.width)).toEqual([]);
        expect(rows.filter(row => row.glyphLines !== 1).map(row => row.width)).toEqual([]);
    });

    test('still paints the glyph on the line it ends', async ({ page }) => {
        const rows = await measureAcrossWidths(page);
        const width = rows.find(row => row.controlLines === Math.min(...rows.map(r => r.controlLines)))!.width;

        const clips = await page.evaluate(({ selectors, columnWidth }) => {
            const root = document.querySelector<HTMLElement>(selectors.container)!;
            root.style.width = `${columnWidth}px`;
            const [hard, control] = [...document.querySelectorAll<HTMLElement>(selectors.paragraph)];
            const lineHeight = Number.parseFloat(globalThis.getComputedStyle(hard!).lineHeight);
            const firstLine = (element: HTMLElement) => {
                const rect = element.getBoundingClientRect();
                return {
                    x: Math.round(rect.x),
                    y: Math.round(rect.y),
                    width: Math.round(rect.width) + 24,
                    height: Math.ceil(lineHeight),
                };
            };

            return { hard: firstLine(hard!), control: firstLine(control!) };
        }, { selectors: editor, columnWidth: width });

        const withGlyph = await page.screenshot({ clip: clips.hard });
        const withoutGlyph = await page.screenshot({ clip: clips.control });

        expect(withGlyph.equals(withoutGlyph)).toBe(false);
    });
});
