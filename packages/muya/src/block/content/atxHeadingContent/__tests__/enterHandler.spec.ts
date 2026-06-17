// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScrollPage } from '../../../scrollPage';
import AtxHeadingContent from '../index';

// Regression: pressing Enter at the start of an ATX heading (e.g. before
// the leading `#`) inserts a new empty paragraph above the heading, but
// the handler used to forget to call `event.preventDefault()`. The
// browser's default Enter behavior then ran on the contenteditable —
// splitting the heading's `<span class="mu-content">` or cloning it —
// producing orphan `mu-content` nodes that were NOT linked back to a
// block via `BLOCK_DOM_PROPERTY`. A subsequent click would resolve to
// such an orphan and `Selection.getSelection` crashed with
// `Cannot read properties of undefined (reading 'path')`.
//
// We exercise the handler directly with a structurally-typed `this` so
// no Muya bootstrap is required.

interface IFakeAtxContent {
    text: string;
    cursor: { start: number; end: number };
    parent: {
        meta: { level: number };
        parent: { insertBefore: (block: unknown, ref: unknown) => void };
    };
    muya: unknown;
    getCursor: () => { start: { offset: number }; end: { offset: number } };
    setCursor: (start: number, end: number, _selected?: boolean) => void;
}

function makeFakeContent(level: number, cursorAt: number): IFakeAtxContent {
    return {
        text: '# Headings',
        cursor: { start: cursorAt, end: cursorAt },
        parent: {
            meta: { level },
            parent: { insertBefore: vi.fn() },
        },
        muya: {},
        getCursor() {
            return {
                start: { offset: this.cursor.start },
                end: { offset: this.cursor.end },
            };
        },
        setCursor(start, end) {
            this.cursor = { start, end };
        },
    };
}

function makeKeyEvent() {
    return {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent;
}

describe('atxHeadingContent.enterHandler — prevents default when inserting paragraph above heading', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('calls preventDefault when Enter is pressed at offset 0 in an H1', () => {
        // Stub ScrollPage.loadBlock so the handler can synthesize a new
        // paragraph block without bootstrapping the registry.
        const fakeParagraphBlock = {};
        const create = vi.fn().mockReturnValue(fakeParagraphBlock);
        vi.spyOn(ScrollPage, 'loadBlock').mockReturnValue({ create } as never);

        const content = makeFakeContent(1, 0);
        const event = makeKeyEvent();

        AtxHeadingContent.prototype.enterHandler.call(
            content as unknown as AtxHeadingContent,
            event,
        );

        expect(event.preventDefault).toHaveBeenCalledTimes(1);
        // Sanity: the paragraph insert path actually ran.
        expect(content.parent.parent.insertBefore).toHaveBeenCalledTimes(1);
    });

    it('calls preventDefault when Enter is pressed right after the `#` in an H1 (offset 1)', () => {
        const fakeParagraphBlock = {};
        const create = vi.fn().mockReturnValue(fakeParagraphBlock);
        vi.spyOn(ScrollPage, 'loadBlock').mockReturnValue({ create } as never);

        // For level=1, the guard is `offset <= level + 1` (=2), so offset
        // 1 still routes through the insert-paragraph branch.
        const content = makeFakeContent(1, 1);
        const event = makeKeyEvent();

        AtxHeadingContent.prototype.enterHandler.call(
            content as unknown as AtxHeadingContent,
            event,
        );

        expect(event.preventDefault).toHaveBeenCalledTimes(1);
        expect(content.parent.parent.insertBefore).toHaveBeenCalledTimes(1);
    });
});
