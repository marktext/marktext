// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { CLASS_NAMES } from '../../config/index';
import { syncTableWidths } from '../tableWidths';

// `syncTableWidths` is the layout pass behind the wide-table fix: it publishes
// the widest table in the document as `--mu-table-width` on the column, and
// flags the tables that still do not fit as scroll containers. The e2e spec
// (`e2e/tests/blocks/table-column-widths-4894.spec.ts`) only observes the end
// result in a real browser, so these tests pin the parts it cannot isolate:
//
//   * the `width: min-content` measurement is put back — the pass reads a width
//     under a temporary inline width, and leaving it behind would restyle the
//     document it just measured,
//   * `.mu-container`'s `max-width` sizes the border box, so the column padding
//     is added to the measured table width,
//   * the measurement is rounded up, and
//   * only the tables that exceed the column by more than the 1px border
//     rounding are flagged, never every table (which would put a permanent
//     scrollbar under a table that lands exactly on the column width).
//
// happy-dom has no layout engine, so widths and padding are stubbed.

const PADDING_PX = 10;

/** Stub the rect happy-dom cannot compute. */
function stubWidth(element: Element, width: number): void {
    element.getBoundingClientRect = () =>
        ({ width, height: 0, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => '' }) as DOMRect;
}

/** Stub the column width happy-dom reports as 0. */
function stubClientWidth(element: HTMLElement, width: number): void {
    Object.defineProperty(element, 'clientWidth', { value: width, configurable: true });
}

/**
 * A `.mu-container` column of `clientWidth` px and `padding` px per side, with
 * `getComputedStyle` stubbed to report that padding.
 */
function makeContainer(clientWidth: number, padding = PADDING_PX): HTMLElement {
    const container = document.createElement('div');
    container.className = 'mu-container';
    stubClientWidth(container, clientWidth);
    document.body.appendChild(container);
    vi.stubGlobal('getComputedStyle', () => ({
        paddingLeft: `${padding}px`,
        paddingRight: `${padding}px`,
    }));

    return container;
}

/** Append `<figure class="mu-table"><table class="mu-table-inner">` of `width`. */
function appendTable(container: HTMLElement, width: number): HTMLTableElement {
    const figure = document.createElement('figure');
    figure.className = 'mu-table';
    const table = document.createElement('table');
    table.className = 'mu-table-inner';
    figure.appendChild(table);
    container.appendChild(figure);
    stubWidth(table, width);

    return table;
}

function figureOf(container: HTMLElement, index: number): HTMLElement {
    return container.querySelectorAll<HTMLElement>('.mu-table')[index];
}

function publishedWidth(container: HTMLElement): string {
    return container.style.getPropertyValue('--mu-table-width');
}

afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
});

describe('syncTableWidths — publishes the widest table as --mu-table-width', () => {
    it('publishes the widest table (rounded up) plus both paddings', () => {
        const container = makeContainer(1200);
        appendTable(container, 300);
        // 452.4 rounds up to 453, making it the widest of the two.
        appendTable(container, 452.4);

        syncTableWidths(container);

        // 453 (rounded up) + 10 + 10 of column padding.
        expect(publishedWidth(container)).toBe('473px');
    });

    it('puts back the inline width it measured under', () => {
        const container = makeContainer(1200);
        const sized = appendTable(container, 300);
        sized.style.width = '100%';
        const unsized = appendTable(container, 200);

        syncTableWidths(container);

        // The pass sets `width: min-content` to measure and must restore it:
        // leaving it behind would restyle the table it just measured, and the
        // published width would then feed back into the next measurement.
        expect(sized.style.width).toBe('100%');
        expect(unsized.style.width).toBe('');
    });

    it('treats a figure with no table inside it as not overflowing', () => {
        const container = makeContainer(500);
        // A real table, so the pass gets past the "no table in the document"
        // guard and actually reaches the per-figure loop.
        appendTable(container, 300);
        const figure = document.createElement('figure');
        figure.className = `mu-table ${CLASS_NAMES.MU_TABLE_OVERFLOWING}`;
        container.appendChild(figure);

        syncTableWidths(container);

        expect(figure.classList.contains(CLASS_NAMES.MU_TABLE_OVERFLOWING)).toBe(false);
    });
});

describe('syncTableWidths — flags the tables that do not fit the column', () => {
    it('flags only what exceeds the column by more than the 1px border rounding', () => {
        // clientWidth 500 - 20 padding = a 480px column.
        const container = makeContainer(500);
        appendTable(container, 470);
        appendTable(container, 900);
        // 481 is within the border-rounding tolerance of the 480px column.
        appendTable(container, 481);
        appendTable(container, 482);

        syncTableWidths(container);

        const flagged = (index: number) =>
            figureOf(container, index).classList.contains(CLASS_NAMES.MU_TABLE_OVERFLOWING);

        expect(flagged(0)).toBe(false); // 470 — fits
        expect(flagged(1)).toBe(true); // 900 — scrolls
        expect(flagged(2)).toBe(false); // 481 — boundary, tolerated
        expect(flagged(3)).toBe(true); // 482 — past the boundary
    });

    it('clears the published width and every flag when the document holds no table', () => {
        const container = makeContainer(1200);
        const figure = document.createElement('figure');
        figure.className = `mu-table ${CLASS_NAMES.MU_TABLE_OVERFLOWING}`;
        container.appendChild(figure);
        container.style.setProperty('--mu-table-width', '999px');

        syncTableWidths(container);

        expect(publishedWidth(container)).toBe('');
        expect(figure.classList.contains(CLASS_NAMES.MU_TABLE_OVERFLOWING)).toBe(false);
    });

    it('keeps the scroll flags on a hidden editor instead of clearing them from a zero-width column', () => {
        // `display: none` (a background tab, a collapsed pane) zeroes the
        // column AND the table's rect: with no guard the pass would then decide
        // `0 > 0 + 1` is false and clear a flag that is still true once the
        // editor comes back on screen.
        const container = makeContainer(0, 0);
        appendTable(container, 0);
        const figure = figureOf(container, 0);
        figure.classList.add(CLASS_NAMES.MU_TABLE_OVERFLOWING);

        syncTableWidths(container);

        expect(figure.classList.contains(CLASS_NAMES.MU_TABLE_OVERFLOWING)).toBe(true);
        // The pass still completed its measurement and published it.
        expect(publishedWidth(container)).toBe('0px');
    });

    it('publishes the measured width before it bails out on the hidden column', () => {
        // The column keeps a width published from a hidden editor, so a table
        // wider than the host is not squeezed on the way back on screen — the
        // ResizeObserver in `Editor` re-runs the pass once it is visible.
        const container = makeContainer(0);
        appendTable(container, 900);

        syncTableWidths(container);

        expect(publishedWidth(container)).toBe('920px');
    });
});
