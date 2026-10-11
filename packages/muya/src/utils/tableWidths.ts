import { CLASS_NAMES } from '../config/index';

/*
 * Table width coordination.
 *
 * A wide table used to be squeezed into the text column until every header
 * wrapped into slivers: `.mu-table-inner` is laid out against the column, and a
 * `min-width` on the cells only sets how far a column may be squeezed — it does
 * not give the table any room. Two rules in `assets/styles/blockSyntax.css` turn
 * the value published here into layout:
 *
 *   .mu-container {
 *     max-width: max(var(--editor-area-width, 800px), var(--mu-table-width, 0px));
 *   }
 *   .mu-table.mu-table-overflowing { overflow-x: auto; }
 *
 * So the column grows to fit the widest table in the document — never past its
 * containing block, i.e. never past the editor area the host gives us — and a
 * table that needs more even than that scrolls itself instead of bleeding into
 * the margin.
 */

// `max-width` sizes the BORDER box, so a target holding only the table's own
// width would leave the column exactly one padding short and the table would go
// on overflowing it. The collapsed borders of a table's columns also round up to
// 1px wider than the table box, so a table within that of the column still
// counts as fitting.
const BORDER_ROUNDING_TOLERANCE = 1;

/**
 * Publish the widest table in `container` as `--mu-table-width` on the column,
 * and mark the tables that remain wider than the column as scroll containers.
 *
 * The width is measured under `width: min-content` — every column at its
 * narrowest, the `min-width: 8ch` floor still respected — and the inline width
 * is restored straight away. That makes the measurement independent of the
 * column width it is about to influence, so the pass cannot feed back into
 * itself: the rendered width of a widened table IS the column width, so reading
 * that instead would grow and shrink the column in a cycle.
 *
 * Cheap enough to run after any content change: it returns before touching
 * layout when the document holds no table.
 */
export function syncTableWidths(container: HTMLElement): void {
    const tables = Array.from(container.querySelectorAll<HTMLTableElement>('.mu-table-inner'));
    const figures = Array.from(container.querySelectorAll<HTMLElement>('.mu-table'));

    if (tables.length === 0) {
        // No table in the document: the column goes back to exactly the host's
        // width, and no figure is left behind as a scroll container.
        container.style.removeProperty('--mu-table-width');
        for (const figure of figures)
            figure.classList.remove(CLASS_NAMES.MU_TABLE_OVERFLOWING);

        return;
    }

    let widest = 0;
    for (const table of tables) {
        const previousWidth = table.style.width;
        table.style.width = 'min-content';
        widest = Math.max(widest, Math.ceil(table.getBoundingClientRect().width));
        table.style.width = previousWidth;
    }

    const { paddingLeft, paddingRight } = getComputedStyle(container);
    const padding = Number.parseFloat(paddingLeft) + Number.parseFloat(paddingRight);
    container.style.setProperty('--mu-table-width', `${widest + padding}px`);

    // Layout has resolved by now, so the column's real width is known: mark only
    // the figures that are genuinely wider than it. Flagging every table would
    // draw a permanent 1px scrollbar under the (very common) table that lands
    // exactly on the column width.
    const column = container.clientWidth - padding;
    if (column <= 0) {
        // Hidden editor (a background tab, a collapsed pane): there is no column
        // width to compare against. Leave the classes as they were; the
        // ResizeObserver in `Editor` re-runs this pass once the editor is on
        // screen again.
        return;
    }

    for (const figure of figures) {
        const table = figure.querySelector('table');
        const overflowing = table != null
            && table.getBoundingClientRect().width > column + BORDER_ROUNDING_TOLERANCE;
        figure.classList.toggle(CLASS_NAMES.MU_TABLE_OVERFLOWING, overflowing);
    }
}
