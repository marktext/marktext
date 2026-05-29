import { describe, expect, it, vi } from 'vitest';
import TableCellContent from '../index';

// Regression for marktext 5fb130d9 "enable shift+tab for table
// navigation" (issue #2330, PR #2331). Previously
// `TableCellContent.tabHandler` always advanced to the next cell,
// regardless of the shift modifier — there was no way to back-navigate
// via the keyboard inside a table.
//
// We drive the handler directly off the prototype with a structurally
// typed `this` so we don't need the full Muya bootstrap (which needs a
// real DOM). The handler only reads `event.shiftKey` and calls
// `previousContentInContext` / `nextContentInContext` on `this`.

// Structural neighbour shape — the table-cell tab handler only calls
// `setCursor` on whatever `prev`/`next` resolves to.
interface IFakeNeighbour {
    setCursor: ReturnType<typeof vi.fn>;
}

function makeFakeCell(prev: IFakeNeighbour | null, next: IFakeNeighbour | null) {
    return {
        nextContentInContext: vi.fn(() => next),
        previousContentInContext: vi.fn(() => prev),
    };
}

function makeFakeNeighbour() {
    return {
        setCursor: vi.fn(),
    };
}

function makeKeyEvent(shiftKey: boolean) {
    return {
        shiftKey,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
    } as unknown as Event;
}

describe('tableCellContent.tabHandler — 5fb130d9 shift+tab backward navigation', () => {
    it('moves to next cell on plain Tab', () => {
        const prev = makeFakeNeighbour();
        const next = makeFakeNeighbour();
        const fakeThis = makeFakeCell(prev, next);

        TableCellContent.prototype.tabHandler.call(
            fakeThis as unknown as TableCellContent,
            makeKeyEvent(false),
        );

        expect(next.setCursor).toHaveBeenCalledWith(0, 0, true);
        expect(prev.setCursor).not.toHaveBeenCalled();
        expect(fakeThis.nextContentInContext).toHaveBeenCalledTimes(1);
        expect(fakeThis.previousContentInContext).not.toHaveBeenCalled();
    });

    it('moves to previous cell on Shift+Tab', () => {
        const prev = makeFakeNeighbour();
        const next = makeFakeNeighbour();
        const fakeThis = makeFakeCell(prev, next);

        TableCellContent.prototype.tabHandler.call(
            fakeThis as unknown as TableCellContent,
            makeKeyEvent(true),
        );

        expect(prev.setCursor).toHaveBeenCalledWith(0, 0, true);
        expect(next.setCursor).not.toHaveBeenCalled();
        expect(fakeThis.previousContentInContext).toHaveBeenCalledTimes(1);
        expect(fakeThis.nextContentInContext).not.toHaveBeenCalled();
    });

    it('no-ops on Shift+Tab when there is no previous content', () => {
        const next = makeFakeNeighbour();
        const fakeThis = makeFakeCell(null, next);

        // Should not throw — first cell of header row has no previous.
        expect(() => {
            TableCellContent.prototype.tabHandler.call(
                fakeThis as unknown as TableCellContent,
                makeKeyEvent(true),
            );
        }).not.toThrow();

        expect(next.setCursor).not.toHaveBeenCalled();
    });
});
