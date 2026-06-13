import { describe, expect, it, vi } from 'vitest';
import ParagraphContent from '../index';

// Regression: Shift+Tab on a list-item paragraph must unindent and then
// STOP. The legacy engine (muyajs tabCtrl.js) returned immediately after
// `unindentListItem`. The TS rewrite was missing that early return, so the
// handler fell through to `insertTab()`. By then `_unindentListItem` had
// cloned the paragraph and removed the original block from the tree, leaving
// `this` detached — `this.getCursor()` returned null and `insertTab`'s
// `const { start, end } = this.getCursor()!` threw
// "Cannot destructure property 'start' of ... as it is null".
//
// We drive the handler off the prototype with a structurally typed `this`,
// mirroring tableCell/__tests__/tabHandler.spec.ts, so we don't need the
// full Muya/DOM bootstrap.

function makeKeyEvent(shiftKey: boolean) {
    return {
        key: 'Tab',
        shiftKey,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        // isKeyboardEvent() checks `'key' in event`.
    } as unknown as Event;
}

interface IFakeParagraph {
    getCursor: ReturnType<typeof vi.fn>;
    isCollapsed: boolean;
    _getUnindentType: ReturnType<typeof vi.fn>;
    _unindentListItem: ReturnType<typeof vi.fn>;
    _canIndentListItem: ReturnType<typeof vi.fn>;
    _checkCursorAtEndFormat: ReturnType<typeof vi.fn>;
    _indentListItem: ReturnType<typeof vi.fn>;
    insertTab: ReturnType<typeof vi.fn>;
    setCursor: ReturnType<typeof vi.fn>;
}

function makeFakeParagraph(overrides: Partial<IFakeParagraph> = {}): IFakeParagraph {
    return {
        getCursor: vi.fn(() => ({ start: { offset: 0 }, end: { offset: 0 } })),
        isCollapsed: true,
        _getUnindentType: vi.fn(() => null),
        _unindentListItem: vi.fn(),
        _canIndentListItem: vi.fn(() => false),
        _checkCursorAtEndFormat: vi.fn(() => null),
        _indentListItem: vi.fn(),
        insertTab: vi.fn(),
        setCursor: vi.fn(),
        ...overrides,
    };
}

function callTabHandler(fakeThis: IFakeParagraph, event: Event) {
    ParagraphContent.prototype.tabHandler.call(
        fakeThis as unknown as ParagraphContent,
        event,
    );
}

describe('paragraphContent.tabHandler — Shift+Tab unindent must not fall through to insertTab', () => {
    it('unindents and returns early on Shift+Tab in a list item (no insertTab)', () => {
        const fakeThis = makeFakeParagraph({
            // unindentable list item
            _getUnindentType: vi.fn(() => 'INDENT' as never),
        });

        expect(() => callTabHandler(fakeThis, makeKeyEvent(true))).not.toThrow();

        expect(fakeThis._unindentListItem).toHaveBeenCalledTimes(1);
        // Must NOT fall through after unindent.
        expect(fakeThis.insertTab).not.toHaveBeenCalled();
        expect(fakeThis._canIndentListItem).not.toHaveBeenCalled();
        expect(fakeThis._checkCursorAtEndFormat).not.toHaveBeenCalled();
    });

    it('no-ops on Shift+Tab when the paragraph is not an unindentable list item', () => {
        const fakeThis = makeFakeParagraph({
            _getUnindentType: vi.fn(() => null),
        });

        expect(() => callTabHandler(fakeThis, makeKeyEvent(true))).not.toThrow();

        expect(fakeThis._unindentListItem).not.toHaveBeenCalled();
        expect(fakeThis.insertTab).not.toHaveBeenCalled();
    });

    it('plain Tab still inserts a tab in a normal paragraph', () => {
        const fakeThis = makeFakeParagraph();

        callTabHandler(fakeThis, makeKeyEvent(false));

        expect(fakeThis.insertTab).toHaveBeenCalledTimes(1);
        expect(fakeThis._unindentListItem).not.toHaveBeenCalled();
    });

    it('plain Tab indents an indentable list item instead of inserting a tab', () => {
        const fakeThis = makeFakeParagraph({
            _canIndentListItem: vi.fn(() => true),
        });

        callTabHandler(fakeThis, makeKeyEvent(false));

        expect(fakeThis._indentListItem).toHaveBeenCalledTimes(1);
        expect(fakeThis.insertTab).not.toHaveBeenCalled();
    });
});
